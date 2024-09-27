package api

// Message structure for custom actions
type WebSocketMessage struct {
	Action  string `json:"action"`
	Content string `json:"content"`
}

// Message representation
type MessageModel struct {
	Id        string
	Timestamp string
	SiteId    string
	Message   string
	To        string
	From      string
	Reactions []string
	Flagged   []string // [{userId: string, Reason}]
}

// Site data representation
type SiteMetdataModel struct {
	Id             string // <:domain:pathname>
	TTL            string // default 24hr,
	ActiveMembers  []string
	TotalMembers   []string
	TotalMessages  int64
	PinnedMessages []string
	IsAdult        bool // If true, need to moderate each and every message for violant, hate, sexual content
	IsActive       bool // If in future some site owners have problem we can disable operations on that site
}
