import { useEffect, useState } from "react";
/// <reference types="chrome"/>

function App() {
	const [state, setState] = useState<{ currentURL: string | null }>({
		currentURL: ""
	});

	useEffect(() => {
		// Update the displayed URL when the background script sends a new URL
		// @ts-ignore
		chrome.runtime.onMessage.addListener((message: { action: string; url: string }) => {
			if (message.action === "updateURL" && message.url) {
				setState((prevState) => ({ ...prevState, currentURL: message.url }));
				// @ts-ignore
				chrome.runtime.sendMessage({ action: "UPDATE_URL_ACK" });
			}
		});
	}, []);

	return <div id="url">{state.currentURL}</div>;
}

export default App;
