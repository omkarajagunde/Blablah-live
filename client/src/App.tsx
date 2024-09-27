import { useEffect, useRef, useState } from "react";
import { ChatInterface } from "./components/chat-interface";
import axios from "axios";
import { getItemFromChromeStorage, sanitizeSiteUrl, setItemInChromeStorage, ChatMessage } from "./lib/utils";
/// <reference types="chrome"/>

function App() {
	const [state, setState] = useState<{ currentURL: string | null }>({
		currentURL: ""
	});
	const [chat, setChat] = useState<ChatMessage[] | []>([]);
	const appReadyRef = useRef<boolean>(false);

	useEffect(() => {
		console.log("chat: ", chat);
	}, [chat]);

	useEffect(() => {
		// Update the displayed URL when the background script sends a new URL

		// @ts-ignore
		chrome.runtime.onMessage.addListener(async (message: { action: string; url: string; data: any | null }) => {
			console.log("registered - ", message);

			// App ready to receive events
			// @ts-ignore
			if (!appReadyRef.current) chrome.runtime.sendMessage({ action: "APP_READY_TO_RECEIVE_EVENT" });
			appReadyRef.current = true;

			if (message.action === "WS_MESSAGE") {
				console.log("App:WS_MESSAGE:received :: ", message.data);

				let userId = await getItemFromChromeStorage("user_id");
				if (userId !== message.data.From.Id) {
					setChat([...chat, message.data]);
				}
			}

			if (message.action === "UPDATE_URL" && message.url) {
				let url = sanitizeSiteUrl(message.url);
				setState((prevState) => ({ ...prevState, currentURL: url }));
				// @ts-ignore

				// // @ts-ignore
				// let port = chrome.runtime.connect({ name: "mySidePanel" });

				// // Trigger the disconnect explicitly when side panel is closed
				// window.addEventListener("beforeunload", () => {
				// 	port.disconnect();
				// });

				await registerUser(url);
				await getOldMessages(url);
			}

			return true;
		});

		console.log("Im hit");
	}, []);

	const registerUser = async (url: string) => {
		// Register the user

		let userId = await getItemFromChromeStorage("user_id");

		try {
			const headers: { [key: string]: string } = {};
			if (userId) {
				// @ts-ignore
				headers["X-Id"] = userId;
				await axios.post(`http://localhost/update/user?IsOnline=true&SiteId=${url}`, {}, { headers });
			}

			if (!userId) {
				let response = await axios.post(`http://localhost/register?SiteId=${url}`);
				setItemInChromeStorage("user_id", response.data.id);
				setItemInChromeStorage("profile", JSON.parse(response.data.data));
				// Create new socket connection...
			}

			// @ts-ignore
			chrome.runtime.sendMessage({ action: "START_WS_SESSION" });
		} catch (error) {
			console.log(error);
		}
	};

	const getOldMessages = async (url: string) => {
		// Get messages
		axios
			.get(`http://localhost/messages?SiteId=${url}&limit=50`)
			.then((resp) => {
				console.log("resp - ", JSON.parse(resp.data.data));
			})
			.catch(console.error);
	};

	return <ChatInterface currentURL={state.currentURL} chat={chat} setChat={setChat} />;
}

export default App;
