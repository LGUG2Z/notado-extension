const BASE_URL = "https://notado.app";
const SAVE_NOTE_MUTATION =
  `mutation SaveNote($note: NewNote!) { saveNote(note: $note) }`;
const SAVE_POSSIBLE_COMMENT_MUTATION =
  `mutation SavePossibleComment($url: String!) { savePossibleComment(url: $url) }`;
const SAVE_KINDLE_HIGHLIGHTS_MUTATION =
  `mutation SaveKindleHighlights($notebook: String!) { saveKindleHighlights(notebook: $notebook) }`;

type NewNote = {
  content: string;
  url: string;
  title: string;
  tags: string[] | null;
};

type GraphQLQuery = {
  query: string;
  variables: Object;
};

function createRequest(query: GraphQLQuery): Request {
  return new Request(`${BASE_URL}/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(query),
  });
}

async function handleResponse(resp: Response, url: string): Promise<void> {
  if (resp.redirected) {
    await browser.tabs.create({
      active: true,
      url: `${BASE_URL}/redirect?to=login`,
    });

    return;
  }

  switch (resp.ok) {
    case true:
      await browser.notifications.create({
        type: "basic",
        iconUrl: "128.png",
        title: browser.i18n.getMessage("notificationTitleNotado"),
        message: url,
      });
      break;
    case false:
      await browser.notifications.create({
        type: "basic",
        iconUrl: "128.png",
        title: browser.i18n.getMessage("notificationTitleTryAgain"),
        message: browser.i18n.getMessage("notificationMessageTryAgain"),
      });
      break;
  }
}

async function sendSelectionToNotado(note: NewNote): Promise<void> {
  let sid = await browser.cookies.get({
    name: "sid",
    url: "https://notado.app",
  });
  console.log(sid);

  let req = createRequest({
    query: SAVE_NOTE_MUTATION,
    variables: { note: note },
  });

  let resp = await fetch(req);
  await handleResponse(resp, note.url);
}

async function sendLinkToNotado(url: string): Promise<void> {
  let sid = await browser.cookies.get({
    name: "sid",
    url: "https://notado.app",
  });
  console.log(sid);

  let req = createRequest({
    query: SAVE_POSSIBLE_COMMENT_MUTATION,
    variables: { url: url },
  });

  let resp = await fetch(req);
  await handleResponse(resp, url);
}

browser.contextMenus.create(
  {
    id: "note-selection",
    title: browser.i18n.getMessage("menuItemSendSelection"),
    contexts: ["selection"],
  },
  () => { },
);

browser.contextMenus.create(
  {
    id: "note-link",
    title: browser.i18n.getMessage("menuItemSendCommentLink"),
    contexts: ["link"],
    targetUrlPatterns: [
      "https://*.reddit.com/r/*/comments/*",
      "https://news.ycombinator.com/item*",
      "https://lobste.rs/s/*/*",
      "https://*.youtube.com/watch*",
      "https://tildes.net/*/*/*",
      "https://twitter.com/*/status/*",
      "https://kulli.sh/comment*",
      "https://*.substack.com/p/*/comment/*",
      "https://*/@*/*",
      "https://bsky.app/profile/*/post/*",
      "https://*/comment/*",
    ],
  },
  () => { },
);

browser.contextMenus.create(
  {
    id: "thread-link",
    title: browser.i18n.getMessage("menuItemSendThreadReaderLink"),
    contexts: ["link"],
    targetUrlPatterns: [
      "https://twitter.com/*/status/*",
      "https://threadreaderapp.com/thread/*.html",
    ],
  },
  () => { },
);

browser.contextMenus.create(
  {
    id: "kullish-page",
    title: browser.i18n.getMessage("menuItemKullishPage"),
    contexts: ["page"],
  },
  () => { },
);

browser.contextMenus.create(
  {
    id: "kindle-import",
    title: browser.i18n.getMessage("menuItemKindleImport"),
    contexts: ["page"],
    documentUrlPatterns: [
      "https://read.amazon.com/notebook*",
    ],
  },
  () => { },
);

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  switch (info.menuItemId) {
    case "note-selection":
      let selectionBody: NewNote = {
        content: info.selectionText!.trim(),
        url: tab!.url!,
        title: tab!.title!,
        tags: null,
      };

      await sendSelectionToNotado(selectionBody);

      break;
    case "note-link":
      await sendLinkToNotado(info.linkUrl!);
      break;
    case "thread-link":
      if (info.linkUrl!.includes("threadreaderapp.com")) {
        await sendLinkToNotado(info.linkUrl!);
        break;
      }
      if (info.linkUrl!.includes("twitter.com")) {
        let tweetId = info.linkUrl!.split("/status/")[1];
        const threadReaderLink =
          `https://threadreaderapp.com/thread/${tweetId}.html`;
        await sendLinkToNotado(threadReaderLink);
        break;
      }
    case "kullish-page":
      await browser.tabs.create({
        url: `https://kulli.sh/search?q=${info.pageUrl}`,
      });

      break;
    case "kindle-import":
      const current =
        (await browser.tabs.query({ currentWindow: true, active: true }))[0];
      await browser.tabs.sendMessage(current.id!, {
        message: "get-html",
      });

      break;
  }
});

browser.runtime.onMessage.addListener(kindleResponse);

async function kindleResponse(request: any, sender: any, sendResponse: any) {
  if (request.message === "send-html") {
    let html: string = request.content;
    let req = createRequest({
      query: SAVE_KINDLE_HIGHLIGHTS_MUTATION,
      variables: { notebook: html },
    });

    let url =
      (await browser.tabs.query({ currentWindow: true, active: true }))[0].url!;
    let resp = await fetch(req);
    await handleResponse(resp, url);
  }
}
