package models

import (
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/brianvoe/gofakeit/v6"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/log"
	"github.com/google/uuid"

	C "server/constants"
	"server/db"
	"server/utils"
)

type Flagged struct {
	Who        string
	Whom       string
	ReasonCode string
}

// User data representation
type UserModel struct {
	Id            string
	Username      string
	Avatar        string
	Ip            string
	IsOnline      bool
	ExploredSites []string
	ActiveSite    string
	Flagged       []Flagged
	IsLoggedIn    bool
	LoginMethod   string // <custom, google>,
	IsBanned      bool
	CreatedAt     time.Time
	ModifiedAt    time.Time
	City          string
	Country       string
	Region        string
	Coords        string
}

func get(tag string, url string, result chan map[string]string) {
	// Call GET API
	res, err := http.Get(url)
	if err != nil {
		log.Error(err.Error())
		result <- map[string]string{
			"tag":   tag,
			"value": "{}",
		}
	}

	// Decode the retrived profile pic
	defer res.Body.Close()
	str, readErr := io.ReadAll(res.Body)
	if readErr != nil {
		log.Error(err.Error())
	}

	result <- map[string]string{
		"tag":   tag,
		"value": string(str),
	}
}

func NewUser(ctx *fiber.Ctx) (*UserModel, bool) {

	ch := make(chan map[string]string)
	defer close(ch)

	username := gofakeit.Gamertag()
	avatarUrl := strings.Replace(C.AVATAR_GENERATOR_URL, "REPLACE_SEED_HERE", username, 1)
	ipUrl := strings.Replace(C.IP_INFO_URL, "REPLACE_IP_HERE", ctx.IP(), 1)

	go get("svg", avatarUrl, ch)
	go get("ipinfo", ipUrl, ch)

	result := map[string]string{}
	temp := <-ch
	result[temp["tag"]] = temp["value"]
	temp = <-ch
	result[temp["tag"]] = temp["value"]

	// Convert string to map
	ipinfoMap, err := utils.Convert_JSONStringToMap(result["ipinfo"])
	if err != nil {
		log.Error("Error:", err, ipinfoMap)
		ipinfoMap = map[string]string{}
	}

	// Get SiteId from Query params
	siteId := ctx.Query("SiteId", "USER_NOT_IN_PLUGIN")
	userId := uuid.New().String()

	user := &UserModel{
		Id:            userId,
		Username:      username,
		Avatar:        result["svg"],
		Ip:            ctx.IP(),
		IsOnline:      true,
		ExploredSites: []string{siteId},
		ActiveSite:    siteId,
		Flagged:       []Flagged{},
		IsLoggedIn:    false,
		LoginMethod:   "",
		IsBanned:      false,
		CreatedAt:     time.Now(),
		ModifiedAt:    time.Now(),
		City:          utils.GetJSONValue(ipinfoMap.(map[string]interface{}), "city"),
		Country:       utils.GetJSONValue(ipinfoMap.(map[string]interface{}), "country"),
		Region:        utils.GetJSONValue(ipinfoMap.(map[string]interface{}), "region"),
		Coords:        utils.GetJSONValue(ipinfoMap.(map[string]interface{}), "loc"),
	}

	mp, _ := utils.StructToRedisMap(*user)
	ok, err := db.Set("users:"+userId, mp)
	if ok {
		log.Info("New user added to redis by id: ", userId)
		return user, true
	} else {
		log.Error("Error while creating new user in redis: ", err)
		return nil, false
	}
}

func GetUser(userId string) (map[string]interface{}, bool) {
	result, err := db.Get("users:" + userId)
	if err {
		log.Error(err)
		return nil, true
	}

	// No records found as empty map is retrieved
	if len(result) == 0 {
		return nil, true
	}

	return result, false
}

func UpdateUser(userId string, mp map[string]interface{}) error {
	hash := "users:" + userId
	present := db.Exists(hash)
	if !present {
		return fmt.Errorf("%s user not found ", userId)
	}
	ok, err := db.Set(hash, mp)
	if ok {
		return nil
	} else {
		return fmt.Errorf("%s", err)
	}
}
