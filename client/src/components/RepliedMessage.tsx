import { ChatMessage, getItemFromChromeStorage } from "@/lib/utils";
import axios from "axios";
import { useEffect, useState } from "react";

function RepliedMessage({ _id, channel }: { _id: string; channel: string | "" }) {
	const [state, setState] = useState<{ isLoading: boolean; message: ChatMessage | null }>({
		isLoading: true,
		message: null
	});

	useEffect(() => {
		loadMessage();
	}, []);

	const loadMessage = async () => {
		let userId = await getItemFromChromeStorage("user_id");

		try {
			const headers: { [key: string]: string } = {};
			if (userId) {
				// @ts-ignore
				headers["X-Id"] = userId;
				let response = await axios.get(`${import.meta.env.VITE_BASE_URL}/message/${_id}?SiteId=${channel}`, {
					headers
				});
				let msg = response.data.data;
				setState((prevState) => ({
					...prevState,
					isLoading: false,
					message: {
						...msg,
						message: msg.Message
					}
				}));
			}
		} catch (error) {}
	};

	return (
		<div className="mt-1 pl-2 border-l-2 border-primary">
			<p className="text-xs text-muted-foreground">
				{state.isLoading && "Loading username..."}{" "}
				{!state.isLoading && state.message && `Reply to @${state.message.from.Username}`}
			</p>
			<p className="text-sm text-muted-foreground mt-2 font-thin">
				{state.isLoading && "Loading message..."} {!state.isLoading && state.message && state.message.message}
			</p>
		</div>
	);
}

export default RepliedMessage;
