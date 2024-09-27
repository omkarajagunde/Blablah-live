package utils

import (
	"encoding/json"
	"fmt"
	"reflect"

	"github.com/gofiber/fiber/v2/log"
)

func Convert_JSONStringToMap(jsonStr string) (interface{}, error) {
	var result interface{}
	// Unmarshal the JSON string into an interface{}
	err := json.Unmarshal([]byte(jsonStr), &result)
	if err != nil {
		return nil, fmt.Errorf("error unmarshalling string to map: %v", err)
	}

	// Check the type of the result
	switch v := result.(type) {
	case map[string]interface{}:
		// The JSON string represents a map
		return v, nil
	case []interface{}:
		// The JSON string represents an array
		return v, nil
	default:
		return nil, fmt.Errorf("unexpected JSON type")
	}
}

// Convert struct to Redis-compatible map
func StructToRedisMap(data interface{}) (map[string]interface{}, error) {
	result := make(map[string]interface{})
	val := reflect.ValueOf(data)

	// Dereference pointer if needed
	if val.Kind() == reflect.Ptr {
		val = reflect.Indirect(val)
	}

	typ := val.Type()

	// Iterate over fields
	for i := 0; i < val.NumField(); i++ {
		fieldName := typ.Field(i).Tag.Get("json")
		if fieldName == "" {
			fieldName = typ.Field(i).Name // Fallback to field name if no json tag
		}

		fieldValue := val.Field(i).Interface()

		// Check if the value is not already a string
		if reflect.TypeOf(fieldValue).Kind() != reflect.String {
			// Marshal non-string values into JSON format
			jsonValue, err := json.Marshal(fieldValue)
			if err != nil {
				return nil, fmt.Errorf("error marshalling field %s: %v", fieldName, err)
			}
			result[fieldName] = string(jsonValue)
		} else {
			// If it's a string, just assign the value
			result[fieldName] = fieldValue
		}
	}

	return result, nil
}

func GetJSONValue(mp map[string]interface{}, key string) string {
	value, ok := mp[key]
	if ok {
		return value.(string)
	}

	return ""
}

func Convert_StringToSlice(mp map[string]interface{}, key string) ([]string, bool) {
	originalArray, ok := mp[key].(string)
	resultArray := []string{}

	if ok {
		err := json.Unmarshal([]byte(originalArray), &resultArray)
		if err != nil {
			log.Error("Error while unmarshalling ", key, " - ", err)
			return nil, false
		}
		return resultArray, true
	}

	return nil, false
}

func Convert_SliceToString(jsonStr []string) string {
	str, err := json.Marshal(jsonStr)
	if err != nil {
		log.Error("Error marshalling to JSON:", err)
	}

	return string(str)
}
