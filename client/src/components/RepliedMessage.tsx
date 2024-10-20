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
				console.log("getMessage -- ", response);
				setState((prevState) => ({ ...prevState, isLoading: false }));
			}
		} catch (error) {}
	};

	return (
		<div className="mt-1 pl-2 border-l-2 border-primary">
			<p className="text-xs text-muted-foreground">{state.isLoading && "Loading..."}</p>
			<p className="text-sm">{state.isLoading && "Loading..."}.</p>
		</div>
	);
}

export default RepliedMessage;
