import React, { useMemo } from "react";
import { Platform } from "react-native";
import { WebView } from "react-native-webview";
import type { VideoCallProps } from "./VideoCall.types";
import dailyBrowserSdk from "../generated/dailyBrowserSdk";

export function VideoCall({ session, onLeave, onError }: VideoCallProps) {
  const origin = new URL(session.url).origin;
  const html = useMemo(() => {
    const options = JSON.stringify({
      url: session.url,
      token: session.token,
    }).replace(/</g, "\\u003c");
    // The pinned SDK is bundled locally. Join tokens stay in memory, out of URLs and browser history.
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><meta name="referrer" content="no-referrer"><style>html,body,#call{margin:0;width:100%;height:100%;background:#101211}iframe{border:0;width:100%;height:100%}</style></head><body><div id="call"></div><script>${dailyBrowserSdk.replace(/<\/script/gi, "<\\/script")}</script><script>
      var send=function(type){window.ReactNativeWebView.postMessage(JSON.stringify({type:type}))};
      try { var call=window.DailyIframe.createFrame(document.getElementById('call'),{iframeStyle:{width:'100%',height:'100%',border:'0'},showLeaveButton:true});
        call.on('left-meeting',function(){send('left')}); call.on('error',function(){send('error')});
        call.join(${options}).catch(function(){send('error')});
        window.addEventListener('pagehide',function(){call.destroy()});
      } catch(e){send('error')}
    </script></body></html>`;
  }, [session]);
  return (
    <WebView
      source={{ html, baseUrl: origin + "/" }}
      style={{ flex: 1, backgroundColor: "#101211" }}
      originWhitelist={[origin]}
      onShouldStartLoadWithRequest={(request) =>
        request.url === "about:blank" || request.url.startsWith(origin + "/")
      }
      javaScriptCanOpenWindowsAutomatically={false}
      setSupportMultipleWindows={false}
      allowsInlineMediaPlayback
      allowsFullscreenVideo
      mediaPlaybackRequiresUserAction={false}
      mediaCapturePermissionGrantType="prompt"
      mixedContentMode="never"
      cacheEnabled={false}
      incognito
      onError={onError}
      onHttpError={(event) => {
        if (event.nativeEvent.statusCode >= 400) onError();
      }}
      onContentProcessDidTerminate={onError}
      onRenderProcessGone={onError}
      onMessage={(event) => {
        // Accept only the small event bridge. No credentials, URLs or provider text are echoed.
        try {
          const message = JSON.parse(event.nativeEvent.data);
          if (message.type === "left") onLeave();
          if (message.type === "error") onError();
        } catch {}
      }}
      applicationNameForUserAgent={`Neem/${Platform.OS}`}
    />
  );
}
