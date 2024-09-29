# Step 1: Use an official Golang image as the build environment
FROM golang:1.23.0-alpine AS builder

# Step 2: Set the working directory inside the container
WORKDIR /app

# Step 3: Copy the Go modules and dependencies first
COPY go.mod go.sum ./

# Step 4: Download the Go dependencies (this helps to cache dependencies for faster builds)
RUN go mod download

# Step 5: Copy the rest of your Go application source code
COPY . .

# Step 6: Build the Go app (the binary will be named 'app')
RUN go build -o app .

# Step 7: Use a minimal base image for the final container
FROM alpine:latest

# Step 8: Set the working directory
WORKDIR /root/

# Step 9: Copy the compiled Go binary from the build stage
COPY --from=builder /app/app .

# Step 10: Expose port 8000 to access the HTTP server
EXPOSE 3000

# Step 11: Set the binary as the entrypoint to be run when the container starts
CMD ["./app"]
