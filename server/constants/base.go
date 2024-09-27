package constants

const (
	POSTGRES_MAX_IDLE_CONNS = 25
	POSTGRES_MAX_OPEN_CONNS = 25
	AVATAR_GENERATOR_URL    = "https://api.dicebear.com/9.x/thumbs/svg?seed=REPLACE_SEED_HERE&radius=50&backgroundColor=0a5b83,1c799f,69d2e7,f1f4dc,f88c49,b6e3f4,c0aede&translateY=15&randomizeIds=true"
	IP_INFO_URL             = "https://ipinfo.io/REPLACE_IP_HERE/json?token=a7dc95b7720b8c"
)

const (
	Tier0 = 0 // Completely blocked
	Tier1 = 1
	Tier2 = 12
	Tier3 = 32
	Tier4 = 64
	Tier5 = 128
	Tier6 = 256
	Tier7 = 512
)
