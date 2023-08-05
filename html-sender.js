function getHtml(request, sender, sendResponse) {
  if (request.message === "get-html") {
    const content = document.documentElement.innerHTML;
    browser.runtime.sendMessage({
      message: "send-html",
      content: content,
    });
  }
}

if (!browser.runtime.onMessage.hasListener(getHtml)) {
  browser.runtime.onMessage.addListener(getHtml);
}
