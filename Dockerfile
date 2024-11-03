# Use the official Nginx image
FROM nginx:latest

# Copy your custom Nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy your web contents
COPY index.html /usr/share/nginx/html
COPY app.js /usr/share/nginx/html
COPY style.css /usr/share/nginx/html

# Copy the self-signed certificate and key into the container
COPY mycert.crt /etc/ssl/certs/
COPY mycert.key /etc/ssl/private/

# Expose port 443
EXPOSE 443
