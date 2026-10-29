package br.com.tegora.conferencia;

import android.Manifest;
import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.InputStream;
import java.io.OutputStream;
import java.util.Set;
import java.util.UUID;

public class MainActivity extends Activity {
    private static final UUID SPP = UUID.fromString("00001101-0000-1000-8000-00805f9b34fb");
    private static final int REQ_FILE = 11;
    private static final int REQ_PERM = 12;

    private WebView web;
    private ValueCallback<Uri[]> fileCb;
    private Uri camUri;

    private volatile BluetoothSocket sock;
    private volatile OutputStream out;
    private volatile boolean connecting;
    private volatile int session = 0;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        web = new WebView(this);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        WebView.setWebContentsDebuggingEnabled(true);
        web.addJavascriptInterface(new Bridge(), "TegoraNative");
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView w, ValueCallback<Uri[]> cb, FileChooserParams p) {
                return openChooser(cb, p);
            }
        });
        if (Build.VERSION.SDK_INT >= 31
                && checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.BLUETOOTH_CONNECT}, REQ_PERM);
        }
        web.loadUrl("file:///android_asset/index.html");
    }

    /* ---------- câmera / galeria para <input type=file> ---------- */
    private boolean openChooser(ValueCallback<Uri[]> cb, WebChromeClient.FileChooserParams p) {
        if (fileCb != null) fileCb.onReceiveValue(null);
        fileCb = cb;
        camUri = null;
        Intent cam = null;
        try {
            ContentValues v = new ContentValues();
            v.put(MediaStore.Images.Media.DISPLAY_NAME, "tegora_" + System.currentTimeMillis() + ".jpg");
            v.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
            v.put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/Tegora");
            camUri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
            if (camUri != null) {
                cam = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                cam.putExtra(MediaStore.EXTRA_OUTPUT, camUri);
            }
        } catch (Exception e) {
            cam = null;
        }
        try {
            Intent go;
            if (p.isCaptureEnabled() && cam != null) {
                go = cam;
            } else {
                Intent pick = p.createIntent();
                go = Intent.createChooser(pick, "Escolher foto");
                if (cam != null) go.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{cam});
            }
            startActivityForResult(go, REQ_FILE);
            return true;
        } catch (Exception e) {
            fileCb = null;
            cb.onReceiveValue(null);
            return false;
        }
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req != REQ_FILE || fileCb == null) return;
        Uri[] result = null;
        if (res == RESULT_OK) {
            if (data != null && (data.getData() != null || data.getClipData() != null)) {
                result = WebChromeClient.FileChooserParams.parseResult(res, data);
            } else if (camUri != null) {
                result = new Uri[]{camUri};
            }
        }
        if (result == null && camUri != null) {
            try { getContentResolver().delete(camUri, null, null); } catch (Exception e) { }
        }
        fileCb.onReceiveValue(result);
        fileCb = null;
        camUri = null;
    }

    /* ---------- chamadas do JavaScript ---------- */
    private void js(final String fn, final String a, final String b) {
        runOnUiThread(new Runnable() {
            public void run() {
                String call = "window." + fn + "&&window." + fn + "(" + JSONObject.quote(a)
                        + (b == null ? "" : "," + JSONObject.quote(b)) + ")";
                web.evaluateJavascript(call, null);
            }
        });
    }

    private boolean hasBtPerm() {
        return Build.VERSION.SDK_INT < 31
                || checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
    }

    private BluetoothAdapter adapter() {
        BluetoothManager m = (BluetoothManager) getSystemService(Context.BLUETOOTH_SERVICE);
        return m == null ? null : m.getAdapter();
    }

    private void closeSock() {
        session++;
        try { if (sock != null) sock.close(); } catch (Exception e) { }
        sock = null;
        out = null;
    }

    public class Bridge {
        @JavascriptInterface
        public String paired() {
            try {
                if (!hasBtPerm()) {
                    runOnUiThread(new Runnable() {
                        public void run() {
                            requestPermissions(new String[]{Manifest.permission.BLUETOOTH_CONNECT}, REQ_PERM);
                        }
                    });
                    return new JSONObject().put("err", "perm").toString();
                }
                BluetoothAdapter ad = adapter();
                if (ad == null || !ad.isEnabled()) return new JSONObject().put("err", "off").toString();
                JSONArray arr = new JSONArray();
                Set<BluetoothDevice> set = ad.getBondedDevices();
                for (BluetoothDevice d : set) {
                    JSONObject o = new JSONObject();
                    o.put("name", d.getName() == null ? "" : d.getName());
                    o.put("address", d.getAddress());
                    arr.put(o);
                }
                return new JSONObject().put("devices", arr).toString();
            } catch (SecurityException e) {
                try { return new JSONObject().put("err", "perm").toString(); } catch (Exception x) { return "{}"; }
            } catch (Exception e) {
                try { return new JSONObject().put("err", String.valueOf(e.getMessage())).toString(); } catch (Exception x) { return "{}"; }
            }
        }

        @JavascriptInterface
        public void connect(final String address) {
            if (connecting) return;
            connecting = true;
            closeSock();
            final int my = session;
            new Thread(new Runnable() {
                public void run() {
                    try {
                        BluetoothAdapter ad = adapter();
                        if (ad == null) { js("__natState", "off", "Este aparelho não tem Bluetooth."); return; }
                        BluetoothSocket s = null;
                        String lastMsg = "";
                        for (int t = 1; t <= 8 && s == null; t++) {
                            if (my != session) return;
                            try {
                                BluetoothDevice d = ad.getRemoteDevice(address);
                                BluetoothSocket c = (t % 2 == 1) ? d.createRfcommSocketToServiceRecord(SPP)
                                        : d.createInsecureRfcommSocketToServiceRecord(SPP);
                                c.connect();
                                s = c;
                            } catch (Exception e) {
                                lastMsg = String.valueOf(e.getMessage());
                                js("__natMsg", "tentativa " + t + "/8 falhou: " + lastMsg + " (deixe o visor da trena aceso)", null);
                                try { Thread.sleep(2000); } catch (InterruptedException ie) { return; }
                            }
                        }
                        if (s == null) {
                            js("__natState", "off", "Não consegui conectar depois de 8 tentativas. Acenda o visor da trena, confirme que ela está pareada e tente de novo.");
                            return;
                        }
                        if (my != session) { try { s.close(); } catch (Exception e) { } return; }
                        sock = s;
                        out = s.getOutputStream();
                        js("__natState", "on", null);
                        InputStream in = s.getInputStream();
                        byte[] buf = new byte[256];
                        for (;;) {
                            int n = in.read(buf);
                            if (n < 0) break;
                            StringBuilder sb = new StringBuilder();
                            for (int i = 0; i < n; i++) sb.append(String.format("%02x", buf[i] & 0xFF));
                            js("__natRx", sb.toString(), null);
                        }
                        if (my == session) js("__natState", "off", "A trena desligou a conexão.");
                    } catch (SecurityException e) {
                        js("__natState", "off", "Sem permissão de Bluetooth. Permita “Dispositivos próximos” e tente de novo.");
                    } catch (Exception e) {
                        if (my == session) js("__natState", "off", "Conexão perdida: " + e.getMessage());
                    } finally {
                        connecting = false;
                    }
                }
            }).start();
        }

        @JavascriptInterface
        public void send(final String hex) {
            new Thread(new Runnable() {
                public void run() {
                    try {
                        OutputStream o = out;
                        if (o == null) return;
                        int n = hex.length() / 2;
                        byte[] b = new byte[n];
                        for (int i = 0; i < n; i++) b[i] = (byte) Integer.parseInt(hex.substring(2 * i, 2 * i + 2), 16);
                        o.write(b);
                        o.flush();
                    } catch (Exception e) {
                        js("__natMsg", "falha ao enviar: " + e.getMessage(), null);
                    }
                }
            }).start();
        }

        @JavascriptInterface
        public void disconnect() {
            closeSock();
            connecting = false;
        }

        @JavascriptInterface
        public void save(String name, String b64) {
            try {
                byte[] data = Base64.decode(b64, Base64.DEFAULT);
                String low = name.toLowerCase();
                String mime = low.endsWith(".pdf") ? "application/pdf"
                        : low.endsWith(".zip") ? "application/zip"
                        : low.endsWith(".json") ? "application/json"
                        : low.endsWith(".dxf") ? "application/octet-stream" : "application/octet-stream";
                ContentValues v = new ContentValues();
                v.put(MediaStore.Downloads.DISPLAY_NAME, name);
                v.put(MediaStore.Downloads.MIME_TYPE, mime);
                v.put(MediaStore.Downloads.RELATIVE_PATH, "Download/Tegora");
                ContentResolver cr = getContentResolver();
                Uri u = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                if (u == null) throw new Exception("não consegui criar o arquivo");
                OutputStream o = cr.openOutputStream(u);
                o.write(data);
                o.close();
                toast("Salvo em Downloads/Tegora: " + name);
            } catch (Exception e) {
                toast("Não foi possível salvar: " + e.getMessage());
            }
        }
    }

    private void toast(final String m) {
        runOnUiThread(new Runnable() {
            public void run() { Toast.makeText(MainActivity.this, m, Toast.LENGTH_LONG).show(); }
        });
    }

    @Override
    protected void onDestroy() {
        closeSock();
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        moveTaskToBack(true);
    }
}
