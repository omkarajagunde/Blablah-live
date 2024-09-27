"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
// import {
// 	DropdownMenu,
// 	DropdownMenuContent,
// 	DropdownMenuItem,
// 	DropdownMenuTrigger
// } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Users,
	MessageSquare,
	Sun,
	Moon,
	Send,
	// MoreVertical,
	SmilePlus,
	Globe,
	ExternalLink,
	Settings,
	User,
	Flag,
	Reply,
	X,
	ChevronDown,
	ChevronUp,
	ArrowUp,
	MessageCircle
} from "lucide-react";
import axios from "axios";
import { ChatMessage, getItemFromChromeStorage } from "@/lib/utils";

const emojis = ["😀", "😂", "😍", "🤔", "👍", "👎", "❤️", "🎉", "🔥", "👀"];
const emojiNames = [
	"grinning",
	"joy",
	"heart_eyes",
	"thinking",
	"thumbsup",
	"thumbsdown",
	"heart",
	"tada",
	"fire",
	"eyes"
];

const giphyStickers = [
	"https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcDdtZ2JiZDR0a3lvNjhwbzNyNHBxcnhxc3Vxb2Q1aXUyZ2QyamtociZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/26BRv0ThflsHCqDrG/giphy.gif",
	"https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcDd1Nm5xYnBwNzVmOWJsdnBnOXg3bXBnNXl6Ynl4d3kydWJvNmYyaCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/3o7aCTfyhYawdOXcFW/giphy.gif",
	"https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMXh6ZWkxZTlkMzFvMWF0NnFxOHFxbXFmNHd3NXV2bG01aHIyeGpmNyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/l0HlGsmOxGDberRJe/giphy.gif"
];

const anonymousNames = [
	"Cosmic Coder",
	"Pixel Wizard",
	"Binary Bard",
	"Quantum Quill",
	"Neural Ninja",
	"Data Dynamo",
	"Logic Luminary",
	"Syntax Sorcerer",
	"Algorithm Ace",
	"Cyber Sage"
];

export function ChatInterface({
	currentURL,
	chat,
	setChat
}: {
	currentURL: string | null;
	chat: ChatMessage[];
	setChat: Function;
}) {
	const [darkMode, setDarkMode] = useState(true);
	const [showUsers, setShowUsers] = useState(false);
	const [showGlobal, setShowGlobal] = useState(false);
	const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
	const [message, setMessage] = useState("");
	const [showEmojiSuggestions, setShowEmojiSuggestions] = useState(false);
	const [pinnedExpanded, setPinnedExpanded] = useState(false);
	const [showScrollToBottom, setShowScrollToBottom] = useState(false);
	const [hoveredMessage, setHoveredMessage] = useState(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const chatRef = useRef<HTMLDivElement>(null);

	const toggleDarkMode = () => setDarkMode(!darkMode);
	const toggleUsersView = () => {
		setShowUsers(!showUsers);
		setShowGlobal(false);
	};
	const toggleGlobalView = () => {
		setShowGlobal(!showGlobal);
		setShowUsers(false);
	};

	useEffect(() => {
		if (textareaRef.current && message.length > 0) {
			textareaRef.current.style.height = "auto";
			textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
		}
	}, [message]);

	useEffect(() => {
		const handleScroll = () => {
			if (chatRef.current) {
				const { scrollTop, scrollHeight, clientHeight } = chatRef.current;
				setShowScrollToBottom(scrollTop < scrollHeight - clientHeight - 100);
			}
		};

		chatRef.current?.addEventListener("scroll", handleScroll);
		return () => chatRef.current?.removeEventListener("scroll", handleScroll);
	}, []);

	const handleMessageChange = (e: any) => {
		setMessage(e.target.value);
		setShowEmojiSuggestions(e.target.value.endsWith(":"));
	};

	const insertEmoji = (emoji: any) => {
		setMessage(message + emoji);
		setShowEmojiSuggestions(false);
	};

	const scrollToBottom = () => {
		chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
	};

	const sendMessage = async () => {
		let userId = await getItemFromChromeStorage("user_id");
		let myProfile = await getItemFromChromeStorage("profile");
		try {
			const headers: { [key: string]: string } = {};
			if (userId) {
				// @ts-ignore
				headers["X-Id"] = userId;
				let messageObj = {
					Timestamp: new Date().toISOString(),
					// @ts-ignore
					From: { Id: String(userId), Avatar: myProfile["Avatar"], Username: myProfile["Username"] },
					To: "",
					Reactions: {},
					Flagged: [],
					Message: message
				};
				let response = await axios.post(`http://localhost/send?SiteId=${currentURL}`, { ...messageObj }, { headers });
				setChat([...chat, { MsgId: response.data.MsgId, Values: messageObj }]);
				if (textareaRef.current) {
					textareaRef.current.value = "";
				}
			}
		} catch (error) {
			console.log(error);
		}
	};

	const groupedMessages = chat.reduce((groups: any, message) => {
		const date = new Date(message.Values.Timestamp).toLocaleDateString();
		if (!groups[date]) {
			groups[date] = [];
		}
		groups[date].push(message);
		return groups;
	}, {});

	return (
		<div className={`flex flex-col h-screen w-full ${darkMode ? "dark" : ""}`}>
			<div className="flex flex-col h-full bg-background text-foreground border border-border rounded-lg overflow-hidden">
				<header className="flex flex-col border-b border-border p-2 space-y-2">
					<div className="flex items-center justify-between">
						<span className="text-sm font-medium truncate">{currentURL}</span>
					</div>
					<div className="flex items-center justify-end space-x-2">
						<div className="flex items-center">
							<span className="relative flex h-3 w-3 mr-2">
								<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
								<span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
							</span>
							<span className="text-sm font-medium">5 users</span>
						</div>
						<Button variant="ghost" size="icon" onClick={toggleGlobalView}>
							<Globe className="h-4 w-4" />
						</Button>
						<Button variant="ghost" size="icon" onClick={toggleUsersView}>
							{showUsers ? <MessageSquare className="h-4 w-4" /> : <Users className="h-4 w-4" />}
						</Button>
						<Button variant="ghost" size="icon">
							<Settings className="h-4 w-4" />
						</Button>
						<Button variant="ghost" size="icon">
							<User className="h-4 w-4" />
						</Button>
						<Button variant="ghost" size="icon" onClick={toggleDarkMode}>
							{darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
						</Button>
					</div>
				</header>

				<Collapsible open={pinnedExpanded} onOpenChange={setPinnedExpanded} className="border-b border-border">
					<CollapsibleTrigger asChild>
						<Button variant="ghost" size="sm" className="flex w-full justify-between p-2">
							<span>Pinned Comments</span>
							{pinnedExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
						</Button>
					</CollapsibleTrigger>
					<CollapsibleContent className="p-2 bg-secondary/50">
						{pinnedExpanded ? (
							<>
								<p className="text-sm">Important: Team meeting at 3 PM today!</p>
								<p className="text-sm">Reminder: Submit your weekly reports by Friday.</p>
							</>
						) : (
							<p className="text-sm truncate">Important: Team meeting at 3 PM today!</p>
						)}
					</CollapsibleContent>
				</Collapsible>

				{showScrollToBottom && (
					<div className="sticky top-0 z-10 flex justify-center py-2 bg-gradient-to-b from-background to-transparent">
						<Button variant="secondary" size="sm" className="rounded-full shadow-md" onClick={scrollToBottom}>
							<ArrowUp className="h-4 w-4 mr-2" />
							View recent messages
						</Button>
					</div>
				)}

				<ScrollArea className="flex-1 p-4">
					{showGlobal ? (
						<div className="space-y-4">
							{[
								{ url: "https://vercel.com", users: 5 },
								{ url: "https://nextjs.org", users: 3 },
								{ url: "https://react.dev", users: 7 }
							].map((site, index) => (
								<div key={index} className="flex items-center justify-between p-2 rounded hover:bg-muted">
									<span className="truncate flex-1 mr-2">{site.url}</span>
									<span className="text-sm font-medium mr-2">{site.users} users</span>
									<Button variant="ghost" size="icon" onClick={() => window.open(site.url, "_blank")}>
										<ExternalLink className="h-4 w-4" />
									</Button>
								</div>
							))}
						</div>
					) : showUsers ? (
						<div className="space-y-4">
							{[
								{ name: anonymousNames[0], online: true, karma: 120 },
								{ name: anonymousNames[1], online: false, karma: 85 },
								{ name: anonymousNames[2], online: true, karma: 230 }
							].map((user, index) => (
								<div key={index} className="flex items-center justify-between p-2 rounded hover:bg-muted">
									<div className="flex items-center space-x-2">
										<div className={`w-2 h-2 rounded-full ${user.online ? "bg-green-500" : "bg-gray-500"}`}></div>
										<img
											src="/placeholder.svg?height=32&width=32"
											alt={`${user.name} avatar`}
											className="w-8 h-8 rounded-full bg-muted"
										/>
										<span className="font-medium">{user.name}</span>
									</div>
									<div className="flex items-center space-x-2">
										<span className="text-sm text-muted-foreground">{user.karma} karma</span>
										<TooltipProvider>
											<Tooltip>
												<TooltipTrigger asChild>
													<Button variant="ghost" size="sm" className="group">
														<MessageCircle className="h-4 w-4 transition-transform group-hover:scale-110" />
													</Button>
												</TooltipTrigger>
												<TooltipContent>
													<p>Send DM</p>
												</TooltipContent>
											</Tooltip>
										</TooltipProvider>
									</div>
								</div>
							))}
						</div>
					) : (
						<div className="space-y-8" ref={chatRef}>
							{Object.entries(groupedMessages).map(([date, messages]: [any, any]) => (
								<div key={date}>
									<div className="flex items-center my-4">
										<div className="flex-grow border-t border-border"></div>
										<span className="mx-4 text-sm text-muted-foreground">
											{date === new Date().toLocaleDateString() ? "Today" : date}
										</span>
										<div className="flex-grow border-t border-border"></div>
									</div>
									{messages.map((msg: any) => (
										<div
											key={msg.Values.From.Id}
											className="flex items-start space-x-2 group relative p-2 rounded-lg"
											onMouseEnter={() => setHoveredMessage(msg.MsgId)}
											onMouseLeave={() => setHoveredMessage(null)}
										>
											<div
												className="w-10 h-10 rounded-full bg-muted"
												dangerouslySetInnerHTML={{ __html: msg.Values.From.Avatar }}
											></div>
											<div className="flex-1">
												<div className="rounded-lg">
													<div className="flex items-center justify-between">
														<span className="font-semibold">{msg.Values.From.Username}</span>
														<span className="text-xs text-muted-foreground">
															{new Date(msg.Values.Timestamp).toLocaleTimeString()}
														</span>
													</div>
													<p className="mt-1 text-sm">{msg.Values.Message}</p>
													{msg.sticker && (
														<img src={msg.sticker} alt="Sticker" className="mt-2 max-w-[200px] rounded" />
													)}
												</div>
												<div className="flex items-center mt-2 space-x-1">
													{Object.entries(msg.Values.Reactions).map(([emoji, count]: [any, any]) => (
														<Button key={emoji} variant="secondary" size="sm" className="text-xs">
															{emoji} {count}
														</Button>
													))}
												</div>
											</div>
											{hoveredMessage === msg.MsgId && (
												<div className="absolute right-2 top-2 flex items-center space-x-1 bg-background/80 backdrop-blur-sm rounded p-1">
													<Popover>
														<PopoverTrigger asChild>
															<Button variant="ghost" size="sm">
																<SmilePlus className="h-4 w-4" />
															</Button>
														</PopoverTrigger>
														<PopoverContent className="w-full p-0">
															<div className="grid grid-cols-5 gap-2 p-2">
																{emojis.map((emoji) => (
																	<Button key={emoji} variant="ghost" size="sm" className="text-lg">
																		{emoji}
																	</Button>
																))}
															</div>
														</PopoverContent>
													</Popover>
													<TooltipProvider>
														<Tooltip>
															<TooltipTrigger asChild>
																<Button variant="ghost" size="sm" onClick={() => setReplyTo(msg)}>
																	<Reply className="h-4 w-4" />
																</Button>
															</TooltipTrigger>
															<TooltipContent>
																<p>Reply</p>
															</TooltipContent>
														</Tooltip>
													</TooltipProvider>
													<TooltipProvider>
														<Tooltip>
															<TooltipTrigger asChild>
																<Button variant="ghost" size="sm">
																	<Flag className="h-4 w-4 text-red-500" />
																</Button>
															</TooltipTrigger>
															<TooltipContent>
																<p>Flag message</p>
															</TooltipContent>
														</Tooltip>
													</TooltipProvider>
												</div>
											)}
										</div>
									))}
								</div>
							))}
						</div>
					)}
				</ScrollArea>

				<footer className="p-2 border-t border-border">
					{replyTo && (
						<div className="flex items-center justify-between bg-muted p-2 rounded mb-2">
							<div className="flex items-center space-x-2">
								<Reply className="h-4 w-4 text-muted-foreground" />
								<span className="text-sm text-muted-foreground">Replying to {replyTo.Values.From.Username}</span>
							</div>
							<Button variant="ghost" size="sm" onClick={() => setReplyTo(null)}>
								<X className="h-4 w-4" />
							</Button>
						</div>
					)}

					<div className="flex items-end space-x-2">
						<Textarea
							ref={textareaRef}
							placeholder="Type a message..."
							className="flex-1 min-h-[40px] max-h-[120px] resize-none"
							value={message}
							onChange={handleMessageChange}
						/>
						<Popover>
							<PopoverTrigger asChild>
								<Button variant="ghost" size="icon">
									<SmilePlus className="h-4 w-4" />
								</Button>
							</PopoverTrigger>
							<PopoverContent className="w-64 p-0">
								<Tabs defaultValue="emoji" className="w-full">
									<TabsList className="grid w-full grid-cols-2">
										<TabsTrigger value="emoji">Emoji</TabsTrigger>
										<TabsTrigger value="stickers">Stickers</TabsTrigger>
									</TabsList>
									<TabsContent value="emoji">
										<ScrollArea className="h-[200px] w-full rounded-md border p-4">
											<div className="grid grid-cols-8 gap-2">
												{emojis.map((emoji) => (
													<Button
														key={emoji}
														variant="ghost"
														size="sm"
														className="text-lg"
														onClick={() => insertEmoji(emoji)}
													>
														{emoji}
													</Button>
												))}
											</div>
										</ScrollArea>
									</TabsContent>
									<TabsContent value="stickers">
										<ScrollArea className="h-[200px] w-full rounded-md border p-4">
											<div className="grid grid-cols-2 gap-2">
												{giphyStickers.map((sticker, index) => (
													<Button
														key={index}
														variant="ghost"
														size="sm"
														className="p-0"
														onClick={() => setMessage(message + ` [sticker:${index}]`)}
													>
														<img src={sticker} alt={`Sticker ${index + 1}`} className="w-full h-auto" />
													</Button>
												))}
											</div>
										</ScrollArea>
									</TabsContent>
								</Tabs>
							</PopoverContent>
						</Popover>
						<Button variant="default" onClick={sendMessage}>
							<Send className="h-4 w-4 mr-2" />
							Send
						</Button>
					</div>
					{showEmojiSuggestions && (
						<div className="absolute bottom-16 left-2 right-2 mt-2 p-2 bg-popover rounded shadow-md">
							<ScrollArea className="h-32">
								<div className="grid grid-cols-2 gap-2">
									{emojiNames.map((name, index) => (
										<Button key={name} variant="ghost" size="sm" onClick={() => insertEmoji(emojis[index])}>
											{emojis[index]} :{name}:
										</Button>
									))}
								</div>
							</ScrollArea>
						</div>
					)}
				</footer>
			</div>
		</div>
	);
}
