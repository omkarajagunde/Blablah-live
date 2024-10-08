# Start from the official Go 1.23 image
FROM golang:1.23

# Set the working directory
WORKDIR /app

# Copy go mod and sum files
COPY go.mod go.sum ./

# Download all dependencies
RUN go mod download

# Copy the source code
COPY . .

# Build the application
RUN go build -o main .

# Expose both the main application port and the profiling port
EXPOSE 8080 6060

# Run the binary
CMD ["./main"]