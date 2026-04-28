#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$ROOT_DIR/deploy"
NGINX_TEMPLATE="$DEPLOY_DIR/nginx/default.conf.template"
NGINX_OUTPUT="$DEPLOY_DIR/nginx/default.conf"
ENV_OUTPUT="$DEPLOY_DIR/.env"
CERTS_DIR="$DEPLOY_DIR/certs"

ASSUME_YES=0
FORCE_OVERWRITE=0
DRY_RUN=0
APT_UPDATED=0
OS_NAME="$(uname -s | tr '[:upper:]' '[:lower:]')"

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
  fi
fi

usage() {
  cat <<'EOF'
Usage: ./install.sh [options]

Options:
  --yes, -y          Use defaults and skip confirmations.
  --force            Overwrite generated files instead of backing up.
  --dry-run          Print actions without changing files.
  -h, --help         Show this help.

Examples:
  ./install.sh
  ./install.sh --yes
  FULLCHAIN_PATH=/path/fullchain.pem PRIVKEY_PATH=/path/privkey.pem ./install.sh --yes
EOF
}

log_info() { echo "[INFO] $*"; }
log_warn() { echo "[WARN] $*"; }
log_error() { echo "[ERROR] $*"; }

run_cmd() {
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "[DRY-RUN] $*"
    return 0
  fi
  "$@"
}

require_privilege_or_fail() {
  if [ "$(id -u)" -ne 0 ] && [ -z "$SUDO" ]; then
    log_error "Package installation requires root or sudo."
    exit 1
  fi
}

detect_pkg_manager() {
  if command -v apt-get >/dev/null 2>&1; then
    printf "%s" "apt"
    return
  fi
  if command -v dnf >/dev/null 2>&1; then
    printf "%s" "dnf"
    return
  fi
  if command -v yum >/dev/null 2>&1; then
    printf "%s" "yum"
    return
  fi
  if command -v pacman >/dev/null 2>&1; then
    printf "%s" "pacman"
    return
  fi
  if command -v zypper >/dev/null 2>&1; then
    printf "%s" "zypper"
    return
  fi
  if command -v brew >/dev/null 2>&1; then
    printf "%s" "brew"
    return
  fi
  printf "%s" ""
}

install_package() {
  local pkg_manager="$1"
  local package_name="$2"

  case "$pkg_manager" in
    apt)
      if [ "$APT_UPDATED" -eq 0 ]; then
        run_cmd $SUDO apt-get update
        APT_UPDATED=1
      fi
      run_cmd $SUDO apt-get install -y "$package_name"
      ;;
    dnf)
      run_cmd $SUDO dnf install -y "$package_name"
      ;;
    yum)
      run_cmd $SUDO yum install -y "$package_name"
      ;;
    pacman)
      run_cmd $SUDO pacman -Sy --noconfirm "$package_name"
      ;;
    zypper)
      run_cmd $SUDO zypper install -y "$package_name"
      ;;
    brew)
      run_cmd brew install "$package_name"
      ;;
    *)
      return 1
      ;;
  esac
}

print_manual_docker_help() {
  log_warn "Unable to auto-install Docker on this environment."
  if [[ "$OS_NAME" == *mingw* ]] || [[ "$OS_NAME" == *msys* ]] || [[ "$OS_NAME" == *cygwin* ]]; then
    log_warn "Install Docker Desktop for Windows: https://www.docker.com/products/docker-desktop/"
  elif [[ "$OS_NAME" == "darwin" ]]; then
    log_warn "Install Docker Desktop for macOS: https://www.docker.com/products/docker-desktop/"
  else
    log_warn "Install Docker and Docker Compose for your distro, then rerun this script."
  fi
}

check_requirements() {
  local pkg_manager
  pkg_manager="$(detect_pkg_manager)"
  local docker_missing=0
  local compose_missing=0

  if ! command -v docker >/dev/null 2>&1; then
    docker_missing=1
  fi
  if ! docker compose version >/dev/null 2>&1; then
    compose_missing=1
  fi

  log_info "Dependency preflight:"
  if [ "$docker_missing" -eq 1 ]; then
    log_info "docker: missing"
  else
    log_info "docker: installed"
  fi
  if [ "$compose_missing" -eq 1 ]; then
    log_info "docker compose: missing"
  else
    log_info "docker compose: installed"
  fi
  log_info "package manager: ${pkg_manager:-not detected}"

  if [ "$docker_missing" -eq 0 ] && [ "$compose_missing" -eq 0 ]; then
    return
  fi

  if [[ "$OS_NAME" != "linux"* ]]; then
    print_manual_docker_help
    exit 1
  fi

  if [ -z "$pkg_manager" ]; then
    print_manual_docker_help
    exit 1
  fi

  require_privilege_or_fail

  if [ "$docker_missing" -eq 1 ]; then
    log_info "Installing docker..."
    if [ "$pkg_manager" = "apt" ]; then
      install_package "$pkg_manager" "docker.io"
    else
      install_package "$pkg_manager" "docker"
    fi
  fi

  if [ "$compose_missing" -eq 1 ]; then
    log_info "Installing docker compose..."
    install_package "$pkg_manager" "docker-compose-plugin" || install_package "$pkg_manager" "docker-compose"
  fi

  if ! command -v docker >/dev/null 2>&1; then
    log_error "Docker installation failed."
    print_manual_docker_help
    exit 1
  fi
  if ! docker compose version >/dev/null 2>&1; then
    log_error "Docker Compose installation failed."
    print_manual_docker_help
    exit 1
  fi
}

check_docker_service_readiness() {
  if [[ "$OS_NAME" != "linux"* ]]; then
    return
  fi

  if docker info >/dev/null 2>&1; then
    return
  fi

  log_warn "Docker daemon is not reachable."
  if command -v systemctl >/dev/null 2>&1; then
    log_info "Trying to start Docker service..."
    if run_cmd $SUDO systemctl enable --now docker; then
      if docker info >/dev/null 2>&1; then
        return
      fi
    fi
    log_error "Docker daemon is still unavailable. Run: systemctl status docker"
  else
    log_error "Start Docker daemon, then rerun."
  fi
}

validate_url() {
  local value="$1"
  if [[ ! "$value" =~ ^https?://[^[:space:]]+$ ]]; then
    log_error "Invalid URL '$value'. Expected format like https://example.com"
    exit 1
  fi
}

validate_port() {
  local value="$1"
  if [[ ! "$value" =~ ^[0-9]+$ ]]; then
    log_error "Port '$value' must be numeric."
    exit 1
  fi
  if [ "$value" -lt 1 ] || [ "$value" -gt 65535 ]; then
    log_error "Port '$value' must be in range 1..65535."
    exit 1
  fi
}

validate_positive_int() {
  local name="$1"
  local value="$2"
  if [[ ! "$value" =~ ^[0-9]+$ ]] || [ "$value" -lt 1 ]; then
    log_error "$name must be a positive integer."
    exit 1
  fi
}

validate_readable_file() {
  local label="$1"
  local path="$2"
  if [ ! -f "$path" ]; then
    log_error "$label file not found at $path"
    exit 1
  fi
  if [ ! -r "$path" ]; then
    log_error "$label file is not readable at $path"
    exit 1
  fi
}

backup_if_exists() {
  local file_path="$1"
  if [ ! -f "$file_path" ]; then
    return
  fi
  if [ "$FORCE_OVERWRITE" -eq 1 ]; then
    return
  fi
  local backup_path="${file_path}.bak.$(date +%Y%m%d%H%M%S)"
  log_info "Backing up existing file: $file_path -> $backup_path"
  run_cmd cp "$file_path" "$backup_path"
}

prompt_default() {
  local prompt="$1"
  local default="$2"
  local value

  if [ "$ASSUME_YES" -eq 1 ]; then
    printf "%s" "$default"
    return
  fi

  read -r -p "$prompt [$default]: " value
  if [ -z "$value" ]; then
    value="$default"
  fi
  printf "%s" "$value"
}

prompt_required() {
  local prompt="$1"
  local env_value="${2:-}"
  local value="$env_value"

  if [ -n "$value" ]; then
    printf "%s" "$value"
    return
  fi

  if [ "$ASSUME_YES" -eq 1 ]; then
    log_error "Missing required value for '$prompt'. Set it as env var when using --yes."
    exit 1
  fi

  while [ -z "$value" ]; do
    read -r -p "$prompt: " value
  done
  printf "%s" "$value"
}

confirm_yes_default() {
  local prompt="$1"
  local reply
  if [ "$ASSUME_YES" -eq 1 ]; then
    printf "%s" "Y"
    return
  fi
  read -r -p "$prompt [Y/n]: " reply
  reply="${reply:-Y}"
  printf "%s" "$reply"
}

parse_args() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --yes|-y)
        ASSUME_YES=1
        shift
        ;;
      --force)
        FORCE_OVERWRITE=1
        shift
        ;;
      --dry-run)
        DRY_RUN=1
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        log_error "Unknown option '$1'"
        usage
        exit 1
        ;;
    esac
  done
}

parse_args "$@"

if [ ! -f "$NGINX_TEMPLATE" ]; then
  log_error "Nginx template not found at $NGINX_TEMPLATE"
  exit 1
fi

log_info "ASA Meet Net deployment setup"
log_info "Generates deploy/.env and nginx config, then optionally starts the stack."
echo

check_requirements
check_docker_service_readiness

collect_config() {
  SERVER_NAME="${SERVER_NAME:-$(prompt_default "Domain / server_name (use _ for any host)" "_")}"
  PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-$(prompt_default "Public base URL for frontend API calls" "https://localhost")}"
  CORS_ALLOWED_ORIGIN="${CORS_ALLOWED_ORIGIN:-$(prompt_default "Allowed CORS origin" "$PUBLIC_BASE_URL")}"
  HTTP_PORT="${HTTP_PORT:-$(prompt_default "Host HTTP port" "80")}"
  HTTPS_PORT="${HTTPS_PORT:-$(prompt_default "Host HTTPS port" "443")}"

  ASPNETCORE_ENVIRONMENT="${ASPNETCORE_ENVIRONMENT:-$(prompt_default "ASPNETCORE_ENVIRONMENT" "Production")}"
  ROOM_IDLE_TTL_SECONDS="${ROOM_IDLE_TTL_SECONDS:-$(prompt_default "Room idle TTL (seconds)" "1800")}"
  CHAT_MESSAGE_TTL_SECONDS="${CHAT_MESSAGE_TTL_SECONDS:-$(prompt_default "Chat message TTL (seconds)" "45")}"
  WAITING_ROOM_TTL_SECONDS="${WAITING_ROOM_TTL_SECONDS:-$(prompt_default "Waiting room request TTL (seconds)" "300")}"
  TEMP_FILE_TTL_SECONDS="${TEMP_FILE_TTL_SECONDS:-$(prompt_default "Temporary file TTL (seconds)" "600")}"
  CLEANUP_SWEEP_INTERVAL_SECONDS="${CLEANUP_SWEEP_INTERVAL_SECONDS:-$(prompt_default "Cleanup sweep interval (seconds)" "5")}"

  echo
  log_info "TLS certificate setup"
  log_info "Provide absolute paths to cert files. They will be copied into deploy/certs."
  FULLCHAIN_PATH="$(prompt_required "Path to fullchain.pem" "${FULLCHAIN_PATH:-}")"
  PRIVKEY_PATH="$(prompt_required "Path to privkey.pem" "${PRIVKEY_PATH:-}")"
}

validate_config() {
  validate_url "$PUBLIC_BASE_URL"
  validate_url "$CORS_ALLOWED_ORIGIN"
  validate_port "$HTTP_PORT"
  validate_port "$HTTPS_PORT"
  validate_positive_int "ROOM_IDLE_TTL_SECONDS" "$ROOM_IDLE_TTL_SECONDS"
  validate_positive_int "CHAT_MESSAGE_TTL_SECONDS" "$CHAT_MESSAGE_TTL_SECONDS"
  validate_positive_int "WAITING_ROOM_TTL_SECONDS" "$WAITING_ROOM_TTL_SECONDS"
  validate_positive_int "TEMP_FILE_TTL_SECONDS" "$TEMP_FILE_TTL_SECONDS"
  validate_positive_int "CLEANUP_SWEEP_INTERVAL_SECONDS" "$CLEANUP_SWEEP_INTERVAL_SECONDS"
  validate_readable_file "fullchain" "$FULLCHAIN_PATH"
  validate_readable_file "private key" "$PRIVKEY_PATH"
}

write_files() {
  run_cmd mkdir -p "$CERTS_DIR"
  backup_if_exists "$NGINX_OUTPUT"
  backup_if_exists "$ENV_OUTPUT"

  log_info "Copying TLS certificates"
  run_cmd cp "$FULLCHAIN_PATH" "$CERTS_DIR/fullchain.pem"
  run_cmd cp "$PRIVKEY_PATH" "$CERTS_DIR/privkey.pem"
  run_cmd chmod 600 "$CERTS_DIR/fullchain.pem" "$CERTS_DIR/privkey.pem"

  log_info "Generating $NGINX_OUTPUT"
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "[DRY-RUN] sed \"s|{{SERVER_NAME}}|$SERVER_NAME|g\" \"$NGINX_TEMPLATE\" > \"$NGINX_OUTPUT\""
  else
    sed "s|{{SERVER_NAME}}|$SERVER_NAME|g" "$NGINX_TEMPLATE" > "$NGINX_OUTPUT"
  fi

  log_info "Generating $ENV_OUTPUT"
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "[DRY-RUN] write env file to $ENV_OUTPUT"
  else
    cat > "$ENV_OUTPUT" <<EOF
VITE_API_URL=$PUBLIC_BASE_URL
CORS_ALLOWED_ORIGIN=$CORS_ALLOWED_ORIGIN
ASPNETCORE_ENVIRONMENT=$ASPNETCORE_ENVIRONMENT
HTTP_PORT=$HTTP_PORT
HTTPS_PORT=$HTTPS_PORT
ROOM_IDLE_TTL_SECONDS=$ROOM_IDLE_TTL_SECONDS
CHAT_MESSAGE_TTL_SECONDS=$CHAT_MESSAGE_TTL_SECONDS
WAITING_ROOM_TTL_SECONDS=$WAITING_ROOM_TTL_SECONDS
TEMP_FILE_TTL_SECONDS=$TEMP_FILE_TTL_SECONDS
CLEANUP_SWEEP_INTERVAL_SECONDS=$CLEANUP_SWEEP_INTERVAL_SECONDS
EOF
  fi
}

deploy_optional() {
  local run_now
  run_now="$(confirm_yes_default "Start deployment now with docker compose up --build -d?")"
  if [[ "$run_now" =~ ^[Yy]$ ]]; then
    if [ "$DRY_RUN" -eq 1 ]; then
      echo "[DRY-RUN] cd \"$DEPLOY_DIR\" && docker compose --env-file .env up --build -d"
    else
      (
        cd "$DEPLOY_DIR"
        docker compose --env-file .env up --build -d
      )
      log_info "Deployment started."
      log_info "Use: cd deploy && docker compose ps"
    fi
  else
    log_info "Skipped running deployment."
    log_info "Run manually: cd deploy && docker compose --env-file .env up --build -d"
  fi
}

post_install_health_check() {
  echo
  log_info "Post-install health check"
  if command -v docker >/dev/null 2>&1; then
    docker --version
  fi
  docker compose version
}

collect_config
validate_config
write_files
post_install_health_check

echo
log_info "Configuration complete."
log_info "Env file: $ENV_OUTPUT"
log_info "Nginx conf: $NGINX_OUTPUT"
log_info "Certs copied to: $CERTS_DIR"
echo

deploy_optional
