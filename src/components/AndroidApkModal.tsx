import React, { useState } from 'react';
import {
  X,
  Smartphone,
  CheckCircle2,
  Copy,
  Download,
  Globe,
  Package,
  AlertCircle,
} from 'lucide-react';
import { playAudioFx } from '../services/audioSynth';
import { PWAInstallButton } from './PWAInstallButton';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface AndroidApkModalProps {
  onClose: () => void;
}

const DEFAULT_SHARED_URL = 'https://ais-pre-a2o4i73vi4ak7o7byjz24u-820329007799.asia-northeast1.run.app';

export const AndroidApkModal: React.FC<AndroidApkModalProps> = ({ onClose }) => {
  const [copied, setCopied] = useState(false);
  const [appName, setAppName] = useState('USE VISION AI');
  const [packageId, setPackageId] = useState('com.usevision.ai');
  const [appUrl, setAppUrl] = useState(() =>
    typeof window !== 'undefined' ? window.location.origin : DEFAULT_SHARED_URL
  );
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [isDownloadingFullApp, setIsDownloadingFullApp] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);
  const { isInstallable, isInstalled } = usePWAInstall();

  const handleDownloadApkProject = async () => {
    setIsDownloadingZip(true);
    setDownloadStatus(null);
    playAudioFx.click();
    try {
      const params = new URLSearchParams({
        appName: appName.trim() || 'USE VISION AI',
        packageId: packageId.trim() || 'com.usevision.ai',
        appUrl: appUrl.trim() || DEFAULT_SHARED_URL,
      });
      const res = await fetch(`/api/android/export-apk-project?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'USE-VISION-AI-Android-APK-Project.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      playAudioFx.acknowledge();
      setDownloadStatus(
        'ZIP downloaded! Isko Android Studio mein open karein ya GitHub Actions par push karke app-debug.apk build karein.'
      );
    } catch (err: any) {
      setDownloadStatus(`Download failed: ${err?.message || 'Error exporting project'}`);
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const handleDownloadFullApp = async () => {
    setIsDownloadingFullApp(true);
    setDownloadStatus(null);
    playAudioFx.click();
    try {
      const res = await fetch('/api/app/download-bundle');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'USE-VISION-AI-Full-App.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      playAudioFx.acknowledge();
      setDownloadStatus('Full App ZIP (src, server, dist & config) downloaded successfully!');
    } catch (err: any) {
      setDownloadStatus(`Full App download failed: ${err?.message || 'Error exporting bundle'}`);
    } finally {
      setIsDownloadingFullApp(false);
    }
  };

  const sampleMainActivity = `// Android Studio MainActivity.java (Full Permissions + File Upload + ESP32 LAN HTTP)
package ${packageId};

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

public class MainActivity extends AppCompatActivity {
    private static final String APP_URL = "${appUrl}";
    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;

    private final ActivityResultLauncher<Intent> fileChooserLauncher =
        registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
            if (filePathCallback == null) return;
            filePathCallback.onReceiveValue(
                WebChromeClient.FileChooserParams.parseResult(result.getResultCode(), result.getData())
            );
            filePathCallback = null;
        });

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#070B14"));
        setContentView(webView);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest req) {
                runOnUiThread(() -> req.grant(req.getResources()));
            }
            @Override
            public boolean onShowFileChooser(WebView w, ValueCallback<Uri[]> cb, FileChooserParams p) {
                filePathCallback = cb;
                fileChooserLauncher.launch(p.createIntent());
                return true;
            }
        });
        webView.loadUrl(APP_URL);
    }
}`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(sampleMainActivity);
    playAudioFx.click();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="cyber-card w-full max-w-lg max-h-[92vh] rounded-2xl flex flex-col overflow-hidden border border-cyan-500/40 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-cyan-500/30">
          <div className="flex items-center space-x-2">
            <Smartphone className="w-5 h-5 text-emerald-400 animate-pulse" />
            <div>
              <h2 className="font-cyber font-bold text-sm text-cyan-300">
                ANDROID APK & MOBILE APP EXPORT
              </h2>
              <p className="text-[10px] font-tech text-slate-400">
                DIRECT PHONE INSTALL (PWA) + COMPLETE ANDROID STUDIO PROJECT
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              playAudioFx.click();
              onClose();
            }}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 flex-1 overflow-y-auto text-xs font-sans">
          {/* Option 1: Direct 1-Tap Android Install (PWA / WebAPK) */}
          <div className="p-3.5 rounded-xl bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-900 border border-emerald-500/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-tech font-bold text-emerald-300 text-xs">
                1. DIRECT MOBILE APP INSTALL (NO PC NEEDED)
              </span>
              <span className="text-[9px] font-mono-cyber px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                {isInstalled ? 'INSTALLED' : isInstallable ? 'READY' : 'PWA READY'}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Is app mein full <strong className="text-white">PWA + Offline Service Worker + App Icons</strong> configured hain. Android Chrome mein Shared App URL kholkar directly phone par install karein:
            </p>
            <PWAInstallButton />
            {!isInstallable && !isInstalled && (
              <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 text-[10px] text-slate-400 leading-relaxed">
                <strong className="text-cyan-300">Android Chrome Tip:</strong> Shared URL ko phone ke Chrome browser mein kholein → upar right <strong className="text-white">⋮ (3 dots)</strong> tap karein → <strong className="text-emerald-300">"Install app"</strong> ya <strong className="text-emerald-300">"Add to Home screen"</strong> select karein. Yeh bilkul native APK app ki tarah fullscreen khulta hai!
              </div>
            )}
          </div>

          {/* Option 2: Download Complete Android Studio APK Project ZIP */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-cyan-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Package className="w-4 h-4 text-cyan-400" />
                <span className="font-tech font-bold text-cyan-300 text-xs">
                  2. COMPLETE ANDROID APK PROJECT (.ZIP)
                </span>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-500/30 flex items-start space-x-2 text-[10px] text-amber-200/90 leading-relaxed">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Note: Browser/server container mein Android SDK & Gradle installed nahi hota, isliye seedhe compiled <code>.apk</code> binary yahan generate nahi ho sakti. Neeche se poora ready-to-compile <strong>Android Studio + GitHub Actions Project (.zip)</strong> download karein — 1 click mein GitHub ya Android Studio se <code>app-debug.apk</code> ban jayegi.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] text-slate-400 font-mono-cyber block mb-1">
                  App Name
                </label>
                <input
                  type="text"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-slate-200 font-mono-cyber text-[11px]"
                />
              </div>
              <div>
                <label className="text-[9px] text-slate-400 font-mono-cyber block mb-1">
                  Android Package ID
                </label>
                <input
                  type="text"
                  value={packageId}
                  onChange={(e) => setPackageId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-slate-200 font-mono-cyber text-[11px]"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[9px] text-slate-400 font-mono-cyber flex items-center space-x-1">
                  <Globe className="w-3 h-3 text-cyan-400" />
                  <span>App Server URL (loaded inside APK)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setAppUrl(DEFAULT_SHARED_URL)}
                  className="text-[9px] font-mono-cyber text-cyan-400 hover:underline"
                >
                  Use Shared URL
                </button>
              </div>
              <input
                type="text"
                value={appUrl}
                onChange={(e) => setAppUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-slate-200 font-mono-cyber text-[10px]"
              />
            </div>

            <button
              onClick={handleDownloadApkProject}
              disabled={isDownloadingZip}
              className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-tech font-bold text-xs tracking-wider shadow-lg shadow-cyan-500/20 disabled:opacity-60 active:scale-95 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>
                {isDownloadingZip
                  ? 'BUILDING ANDROID PROJECT ZIP...'
                  : 'DOWNLOAD ANDROID APK PROJECT (.ZIP)'}
              </span>
            </button>

            <button
              onClick={handleDownloadFullApp}
              disabled={isDownloadingFullApp}
              className="w-full flex items-center justify-center space-x-2 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-cyan-500/40 text-cyan-200 font-tech font-bold text-xs tracking-wider disabled:opacity-60 active:scale-95 transition-all"
            >
              <Package className="w-4 h-4 text-cyan-400" />
              <span>
                {isDownloadingFullApp
                  ? 'PACKAGING FULL APP FILES...'
                  : 'DOWNLOAD FULL APP CODE + BUILD (.ZIP)'}
              </span>
            </button>

            {downloadStatus && (
              <p className="text-[10px] font-mono-cyber text-emerald-300 bg-emerald-950/40 border border-emerald-500/30 rounded-lg p-2">
                {downloadStatus}
              </p>
            )}
          </div>

          {/* Checklist */}
          <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
            <span className="font-tech font-bold text-emerald-300 text-xs block">
              INCLUDED IN ANDROID APK BUNDLE (TOTAL FEATURES)
            </span>
            <div className="space-y-1.5 font-mono-cyber text-[10px] text-slate-300">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Camera & Microphone Permissions (Vision, Face, Gesture, Voice AI)</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Android Gallery File Picker (Face Multi-Photo Enroll & Vision Scan)</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Local LAN HTTP Cleartext Config (ESP32 WiFi IP Connection)</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>GitHub Actions Auto-APK Workflow + Android Studio Gradle Files</span>
              </div>
            </div>
          </div>

          {/* Code Snippet */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-tech font-bold text-slate-300 text-xs">
                MAINACTIVITY.JAVA PREVIEW
              </span>
              <button
                onClick={handleCopyCode}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono-cyber text-[10px] flex items-center space-x-1"
              >
                <Copy className="w-3 h-3" />
                <span>{copied ? 'COPIED' : 'COPY'}</span>
              </button>
            </div>
            <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono-cyber text-[10px] text-cyan-400 overflow-x-auto leading-relaxed max-h-40">
              {sampleMainActivity}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
