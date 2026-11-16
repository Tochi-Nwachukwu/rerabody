import Script from "next/script";

import { getSiteSettings } from "@/server/queries/settings";

/** Third-party chat embed (Tawk.to or Crisp), controlled by the chatWidget setting in A28. */
export async function ChatWidget() {
  const { chatWidget } = await getSiteSettings();
  if (!chatWidget.enabled || !chatWidget.siteId) return null;
  if (chatWidget.provider === "tawk") {
    return (
      <Script
        id="chat-tawk"
        src={`https://embed.tawk.to/${chatWidget.siteId}`}
        strategy="lazyOnload"
        crossOrigin="anonymous"
      />
    );
  }
  return (
    <>
      <Script
        id="chat-crisp-config"
        strategy="lazyOnload"
      >{`window.$crisp=[];window.CRISP_WEBSITE_ID=${JSON.stringify(chatWidget.siteId)};`}</Script>
      <Script id="chat-crisp" src="https://client.crisp.chat/l.js" strategy="lazyOnload" />
    </>
  );
}
