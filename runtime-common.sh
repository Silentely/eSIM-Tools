#!/bin/bash
#
# Runtime common functions for fuckits
# Shared between main.sh (EN) and zh_main.sh (ZH)
# This file is sourced at runtime, not during build
#

_fuck_json_escape() {
    local input="$1"
    if command -v python3 >/dev/null 2>&1; then
        printf '%s' "$input" | python3 -c "import json,sys; print(json.dumps(sys.stdin.read())[1:-1], end='')"
        return
    fi
    if command -v node >/dev/null 2>&1; then
        printf '%s' "$input" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(d).slice(1,-1)))"
        return
    fi
    # Minimal fallback: escape backslashes and double quotes only
    printf '%s' "$input" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/	/\\t/g'
}

_fuck_truthy() {
    local value="${1:-}"
    local normalized
    normalized=$(printf '%s' "$value" | tr '[:upper:]' '[:lower:]')
    case "$normalized" in
        1|true|yes|y|on|是|开|真)
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

_fuck_security_level_value() {
    case "$1" in
        block) printf '3\n' ;;
        challenge) printf '2\n' ;;
        warn) printf '1\n' ;;
        *) printf '0\n' ;;
    esac
}

_fuck_security_match_rule() {
    local command="$1"
    local table="$2"
    local -a rules=()

    # SECURITY NOTE: This eval is SAFE because:
    # - $table only receives hardcoded internal array names from callers within this script
    # - Valid values: _FUCK_SECURITY_BLOCK_RULES, _FUCK_SECURITY_CHALLENGE_RULES, _FUCK_SECURITY_WARN_RULES
    # - No user input can reach this variable; it's purely for dynamic array name resolution
    # - This pattern is a standard Bash idiom for indirect array access (Bash 3.x compatible)
    eval "rules=(\"\${${table}[@]}\")"

    local rule pattern reason
    for rule in "${rules[@]}"; do
        pattern=${rule%%|||*}
        reason=${rule#*|||}
        [ -z "$pattern" ] && continue

        if printf '%s' "$command" | grep -Eiq -- "$pattern"; then
            printf '%s\n' "$reason"
            return 0
        fi
    done

    return 1
}

_fuck_security_is_whitelisted() {
    local command="$1"
    local whitelist="${FUCK_SECURITY_WHITELIST:-}"

    if [ -z "$whitelist" ]; then
        return 1
    fi

    local normalized entry
    normalized=$(printf '%s' "$whitelist" | tr ',' '\n')

    while IFS= read -r entry; do
        entry=$(printf '%s' "$entry" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
        [ -z "$entry" ] && continue

        # 前缀匹配：命令必须以白名单条目开头（或完全相等）
        # 例如白名单 "ls" 匹配 "ls -la" 但不匹配 "vls"
        if [[ "$command" == "$entry" ]] || [[ "$command" == "$entry "* ]]; then
            return 0
        fi
    done <<< "$normalized"

    return 1
}

_fuck_security_mode() {
    local mode="${FUCK_SECURITY_MODE:-balanced}"
    mode=$(printf '%s' "$mode" | tr '[:upper:]' '[:lower:]')

    case "$mode" in
        strict) printf 'strict\n' ;;
        off|disabled|none) printf 'off\n' ;;
        balanced|default|"") printf 'balanced\n' ;;
        *) printf 'balanced\n' ;;
    esac
}

_fuck_mark_static_cache_dirty() {
    _FUCK_STATIC_CACHE_DIRTY=1
}

_fuck_load_static_cache() {
    # Return early if cache is already loaded
    if [ "${_FUCK_STATIC_CACHE_LOADED:-0}" -eq 1 ]; then
        return 0
    fi

    _FUCK_STATIC_CACHE_LOADED=1

    # Source cache file if it exists
    if [ -f "$FUCK_SYSINFO_CACHE_FILE" ]; then
        # shellcheck disable=SC1090
        source "$FUCK_SYSINFO_CACHE_FILE" || true
    fi
}

_fuck_persist_static_cache() {
    # Only persist if cache is dirty
    if [ "${_FUCK_STATIC_CACHE_DIRTY:-0}" -ne 1 ]; then
        return 0
    fi

    # Ensure cache directory exists
    local cache_dir
    cache_dir=$(dirname "$FUCK_SYSINFO_CACHE_FILE")
    if ! mkdir -p "$cache_dir" 2>/dev/null; then
        return 1
    fi

    # Create temporary file for atomic write
    local tmp_file
    tmp_file=$(mktemp) || return 1

    # Write cached variables to temporary file
    {
        printf '_FUCK_CACHED_DISTRO=%q\\n' "${_FUCK_CACHED_DISTRO:-}"
        printf '_FUCK_CACHED_KERNEL=%q\\n' "${_FUCK_CACHED_KERNEL:-}"
        printf '_FUCK_CACHED_ARCH=%q\\n' "${_FUCK_CACHED_ARCH:-}"
        printf '_FUCK_CACHED_PKG_MANAGER=%q\\n' "${_FUCK_CACHED_PKG_MANAGER:-}"
    } > "$tmp_file"

    # Atomic move to final location
    if command mv -f -- "$tmp_file" "$FUCK_SYSINFO_CACHE_FILE" 2>/dev/null; then
        _FUCK_STATIC_CACHE_DIRTY=0
        return 0
    else
        # Clean up temporary file on failure
        rm -f "$tmp_file"
        return 1
    fi
}

_fuck_audit_log() {
    # Check if audit logging is enabled
    if [ "${FUCK_AUDIT_LOG:-false}" != "true" ]; then
        return 0
    fi
    
    local event="$1"
    local command="$2"
    local exit_code="${3:--}"
    local timestamp
    timestamp=$(date -u '+%Y-%m-%d %H:%M:%S UTC' 2>/dev/null || date '+%Y-%m-%d %H:%M:%S')
    local log_file="${FUCK_AUDIT_LOG_FILE:-$INSTALL_DIR/.audit.log}"
    
    # Ensure log directory exists
    mkdir -p "$(dirname "$log_file")" 2>/dev/null || true
    
    # Sanitize command for logging (normalize newlines, escape delimiter, limit length)
    local sanitized_cmd
    local raw_len=${#command}
    sanitized_cmd=$(printf '%s' "$command" | tr '\r\n' '  ' | sed 's/|/\\|/g' | head -c 200)
    if [ "$raw_len" -gt 200 ]; then
        sanitized_cmd="${sanitized_cmd}..."
    fi
    
    # Write to log file (format: timestamp|user|event|exit_code|command)
    printf '%s|%s|%s|%s|%s\n' "${timestamp}" "${USER:-unknown}" "${event}" "${exit_code}" "${sanitized_cmd}" >> "$log_file" 2>/dev/null || true
    
    # Secure the log file
    chmod 600 "$log_file" 2>/dev/null || true
}

_fuck_detect_distro() {
    _fuck_load_static_cache

    # Return cached value if available
    if [ -n "${_FUCK_CACHED_DISTRO:-}" ]; then
        printf '%s\n' "$_FUCK_CACHED_DISTRO"
        return 0
    fi

    local kernel_name distro id version pretty family
    kernel_name=$(uname -s 2>/dev/null || printf 'unknown')
    distro="unknown"

    # macOS detection
    if [ "$kernel_name" = "Darwin" ]; then
        local product version
        product=$(sw_vers -productName 2>/dev/null || printf 'macOS')
        product=$(printf '%s' "$product" | tr -d '\r\n')
        version=$(sw_vers -productVersion 2>/dev/null || printf 'unknown')
        version=$(printf '%s' "$version" | tr -d '\r\n')
        distro="$product $version"
    # Linux detection using /etc/os-release
    elif [ -r /etc/os-release ]; then
        id=$(grep -E '^ID=' /etc/os-release | head -n1 | cut -d= -f2 | tr -d '"' | tr '[:upper:]' '[:lower:]')
        version=$(grep -E '^VERSION_ID=' /etc/os-release | head -n1 | cut -d= -f2 | tr -d '"')
        pretty=$(grep -E '^PRETTY_NAME=' /etc/os-release | head -n1 | cut -d= -f2- | tr -d '"')

        # Determine OS family for better categorization
        family=""
        case "$id" in
            ubuntu|debian)
                family="Debian-based"
                ;;
            centos|rhel|rocky|almalinux|fedora)
                family="RHEL-based"
                ;;
            arch|manjaro|endeavouros)
                family="Arch-based"
                ;;
        esac

        # Format distribution string with family and version
        if [ -n "$family" ]; then
            distro="$family ${version:-}"
            if [ -n "$pretty" ]; then
                distro="$distro (${pretty})"
            fi
        else
            distro="${pretty:-Linux $version}"
        fi
    else
        distro="$kernel_name"
    fi

    # Cache and return result
    _FUCK_CACHED_DISTRO="$distro"
    _fuck_mark_static_cache_dirty
    printf '%s\n' "$distro"
}

_fuck_detect_pkg_manager() {
    _fuck_load_static_cache

    # Return cached value if available
    if [ -n "${_FUCK_CACHED_PKG_MANAGER:-}" ]; then
        printf '%s\n' "$_FUCK_CACHED_PKG_MANAGER"
        return 0
    fi

    local manager="unknown"

    # Detect package manager in order of preference
    if command -v apt-get &> /dev/null; then
        manager="apt"
    elif command -v yum &> /dev/null; then
        manager="yum"
    elif command -v dnf &> /dev/null; then
        manager="dnf"
    elif command -v pacman &> /dev/null; then
        manager="pacman"
    elif command -v zypper &> /dev/null; then
        manager="zypper"
    elif command -v brew &> /dev/null; then
        manager="brew"
    fi

    # Cache and return result
    _FUCK_CACHED_PKG_MANAGER="$manager"
    _fuck_mark_static_cache_dirty
    printf '%s\n' "$manager"
}

_fuck_get_architecture() {
    _fuck_load_static_cache

    # Return cached value if available
    if [ -n "${_FUCK_CACHED_ARCH:-}" ]; then
        printf '%s\n' "$_FUCK_CACHED_ARCH"
        return 0
    fi

    local arch
    arch=$(uname -m 2>/dev/null || printf 'unknown')
    arch=$(printf '%s' "$arch" | tr -d '\r\n')

    # Cache and return result
    _FUCK_CACHED_ARCH="$arch"
    _fuck_mark_static_cache_dirty
    printf '%s\n' "$arch"
}

_fuck_get_kernel_version() {
    _fuck_load_static_cache

    # Return cached value if available
    if [ -n "${_FUCK_CACHED_KERNEL:-}" ]; then
        printf '%s\n' "$_FUCK_CACHED_KERNEL"
        return 0
    fi

    local kernel
    kernel=$(uname -sr 2>/dev/null || uname -s 2>/dev/null || printf 'unknown')
    kernel=$(printf '%s' "$kernel" | tr -d '\r\n')

    # Cache and return result
    _FUCK_CACHED_KERNEL="$kernel"
    _fuck_mark_static_cache_dirty
    printf '%s\n' "$kernel"
}

_fuck_collect_tool_versions() {
    local tools tool version result
    tools="git docker npm kubectl curl wget"
    result=""

    for tool in $tools; do
        version="not-installed"

        if command -v "$tool" >/dev/null 2>&1; then
            case "$tool" in
                git|docker|curl|wget)
                    version=$("$tool" --version 2>/dev/null | head -n1)
                    ;;
                npm)
                    version=$("$tool" --version 2>/dev/null | head -n1)
                    [ -n "$version" ] && version="npm $version"
                    ;;
                kubectl)
                    version=$("$tool" version --client --short 2>/dev/null | head -n1)
                    ;;
            esac
        fi

        # Clean up version string
        version=$(printf '%s' "${version:-unknown}" | tr '\r\n' '  ' | tr -s ' ' | sed -e 's/^ *//' -e 's/ *$//')
        [ -z "$version" ] && version="unknown"

        result="$result$tool:$version; "
    done

    # Remove trailing semicolon and space
    result="${result%; }"
    printf '%s' "$result"
}

_fuck_append_config_hint() {
    local key="$1"
    local comment="$2"
    local sample="$3"
    local quoted="${4:-1}"
    [ -f "$CONFIG_FILE" ] || return
    if grep -Eq "^\\s*#?\\s*export\\s+$key" "$CONFIG_FILE"; then
        return
    fi

    local assignment
    if [ "$quoted" = "1" ]; then
        assignment="# export $key=\"$sample\""
    else
        assignment="# export $key=$sample"
    fi

    {
        printf '\n'
        printf '# %s\n' "$comment"
        printf '%s\n' "$assignment"
    } >> "$CONFIG_FILE"
}

_fuck_define_aliases() {
    local default_alias="fuck"

    if ! _fuck_truthy "${FUCK_DISABLE_DEFAULT_ALIAS:-0}"; then
        alias "$default_alias"='_fuck_execute_prompt'
    fi

    if [ -n "${FUCK_ALIAS:-}" ] && [ "$FUCK_ALIAS" != "$default_alias" ]; then
        alias "$FUCK_ALIAS"='_fuck_execute_prompt'
    fi
}

_fuck_detect_dangerous_command() {
    _fuck_security_evaluate_command "$1"
}

_fuck_local_system_prompt() {
    local sysinfo="$1"
    if [ "$FUCKITS_LOCALE" = "zh" ]; then
        printf '你是一个专业的 shell 命令生成器。用户会用自然语言描述他们想要完成的任务。你的任务是生成直接可执行的 shell 命令来完成用户的目标。

重要规则：
1. 用户输入是自然语言描述意图，不是命令参数。例如"列出目录"意思是执行 ls 命令，而不是 ls "列出目录"
2. 生成直接可执行的命令，不要生成带参数判断的脚本模板（如 if [ $# -eq 0 ]）
3. 对于简单任务直接返回单条命令，复杂任务可以是多行脚本
4. 不要提供任何解释、注释、markdown 格式（比如 ```bash）或 shebang（例如 #!/bin/bash）

示例：
- 用户说"列出目录" → 输出: ls
- 用户说"显示详细文件列表" → 输出: ls -la
- 用户说"查找大于10MB的文件" → 输出: find . -type f -size +10M

用户的系统信息是：%s' "$sysinfo"
    else
        printf 'You are an expert shell command generator. Users describe tasks in natural language. Your task is to generate directly executable shell commands to accomplish their goals.

Important rules:
1. User input is natural language intent, NOT command arguments. For example, "list directory" means run ls, not ls "list directory"
2. Generate directly executable commands, not script templates with parameter handling (like if [ $# -eq 0 ])
3. For simple tasks return single commands, complex tasks can be multi-line scripts
4. Do not provide any explanation, comments, markdown formatting (like ```bash), or a shebang (e.g., #!/bin/bash)

Examples:
- User says "list directory" → Output: ls
- User says "show detailed file list" → Output: ls -la
- User says "find files larger than 10MB" → Output: find . -type f -size +10M

The user'"'"'s system info is: %s' "$sysinfo"
    fi
}

_fuck_secure_config_file() {
    if [ -f "$CONFIG_FILE" ]; then
        chmod 600 "$CONFIG_FILE" 2>/dev/null || true
    fi
}

_fuck_security_apply_mode() {
    local mode="$1"
    local severity="$2"

    case "$mode" in
        strict)
            case "$severity" in
                warn) severity="challenge" ;;
                challenge) severity="block" ;;
            esac
            ;;
    esac

    printf '%s\n' "$severity"
}

_fuck_security_prompt_phrase() {
    local phrase="$1"
    local input=""

    printf "%b> %b" "$C_BOLD" "$C_RESET" >&2

    if [ -r /dev/tty ]; then
        if ! IFS= read -r input < /dev/tty; then
            printf "\n" >&2
            return 1
        fi
    else
        if ! IFS= read -r input; then
            printf "\n" >&2
            return 1
        fi
    fi

    printf "\n" >&2
    [ "$input" = "$phrase" ]
}

_fuck_security_promote() {
    local current="$1"
    local candidate="$2"
    local current_val candidate_val

    current_val=$(_fuck_security_level_value "$current")
    candidate_val=$(_fuck_security_level_value "$candidate")

    if [ "$candidate_val" -gt "$current_val" ]; then
        printf '%s\n' "$candidate"
    else
        printf '%s\n' "$current"
    fi
}

_fuck_should_use_local_api() {
    if [ -n "${FUCK_OPENAI_API_KEY:-}" ]; then
        return 0
    fi
    return 1
}

# --- 以下为共享工具函数（从 main.sh/zh_main.sh 提取） ---

# 安全验证配置文件，防止代码注入
# 参数：$1 - 要验证的文件路径
# 返回：0 如果安全，1 如果不安全或出错
_fuck_validate_config_file() {
    local file="$1"

    # 文件必须存在且可读
    if [ ! -f "$file" ] || [ ! -r "$file" ]; then
        return 1
    fi

    # 检查文件权限 - 必须由当前用户拥有
    if [ "$(stat -c '%u' "$file" 2>/dev/null || stat -f '%u' "$file" 2>/dev/null)" != "$(id -u)" ]; then
        echo -e "${C_RED}Config file not owned by current user, refusing to source.${C_RESET}" >&2
        return 1
    fi

    local line_num=0
    local line

    # 预定义正则表达式变量（zsh 兼容性：变量形式避免特殊字符解析问题）
    local re_cmd_sub='\$\('
    local re_backtick='`'
    local re_arith='\$\(\('
    local re_semi=';'
    local re_and='&&'
    local re_or='\|\|'
    local re_pipe='\|'
    local re_gt='>'
    local re_lt='<'
    local re_amp='&'
    local re_esc='\\\$'

    while IFS= read -r line || [ -n "$line" ]; do
        line_num=$((line_num + 1))

        # 跳过空行
        if [ -z "$line" ] || [[ "$line" =~ ^[[:space:]]*$ ]]; then
            continue
        fi

        # 跳过注释行（以 # 开头，可有前导空白）
        if [[ "$line" =~ ^[[:space:]]*# ]]; then
            continue
        fi

        # 检查危险的 shell 元字符和命令替换
        # 拒绝：$(), ``, $((), ;, &&, ||, | (管道), >, <, &, 换行转义
        if [[ "$line" =~ $re_cmd_sub ]] || \
           [[ "$line" =~ $re_backtick ]] || \
           [[ "$line" =~ $re_arith ]] || \
           [[ "$line" =~ $re_semi ]] || \
           [[ "$line" =~ $re_and ]] || \
           [[ "$line" =~ $re_or ]] || \
           [[ "$line" =~ $re_pipe ]] || \
           [[ "$line" =~ $re_gt ]] || \
           [[ "$line" =~ $re_lt ]] || \
           [[ "$line" =~ $re_amp ]] || \
           [[ "$line" =~ $re_esc ]]; then
            _fuck_debug "Config validation failed at line $line_num: dangerous metacharacter detected"
            echo -e "${C_RED}Unsafe config file: dangerous shell metacharacter at line $line_num${C_RESET}" >&2
            return 1
        fi

        # 只允许：export FUCK_*=... 或 FUCK_*=...（可有前导空白）
        # 也允许：export FUCKITS_LOCALE=...
        if [[ "$line" =~ ^[[:space:]]*(export[[:space:]]+)?(FUCK_[A-Z_]+|FUCKITS_LOCALE)= ]]; then
            continue
        fi

        # 拒绝其他任何内容
        _fuck_debug "Config validation failed at line $line_num: unrecognized pattern"
        echo -e "${C_RED}Unsafe config file: unrecognized pattern at line $line_num${C_RESET}" >&2
        return 1
    done < "$file"

    return 0
}

# 验证后安全地加载配置文件
# 参数：$1 - 要加载的文件路径
# 返回：0 如果成功加载，1 如果验证失败或文件不存在
_fuck_safe_source_config() {
    local file="$1"

    if [ ! -f "$file" ]; then
        return 0  # 没有文件也没关系
    fi

    if _fuck_validate_config_file "$file"; then
        # shellcheck disable=SC1090
        source "$file"
        return $?
    else
        echo -e "${C_YELLOW}Config file validation failed, skipping: $file${C_RESET}" >&2
        return 1
    fi
}

# 找用户 shell 配置文件的辅助函数
_installer_detect_profile() {
    if [ -n "${SHELL:-}" ] && echo "$SHELL" | grep -q "zsh"; then
        echo "$HOME/.zshrc"
    elif [ -n "${SHELL:-}" ] && echo "$SHELL" | grep -q "bash"; then
        echo "$HOME/.bashrc"
    elif [ -f "$HOME/.profile" ]; then
        # 兼容 sh, ksh 等
        echo "$HOME/.profile"
    elif [ -f "$HOME/.zshrc" ]; then
        # SHELL 变量没设置时的备用方案
        echo "$HOME/.zshrc"
    elif [ -f "$HOME/.bashrc" ]; then
        # SHELL 变量没设置时的备用方案
        echo "$HOME/.bashrc"
    else
        echo "unknown_profile"
    fi
}

# 收集用户信息包括权限级别
# 输出：用户信息字符串（如："User=john uid=1000 level=sudoer Groups=john adm sudo"）
_fuck_collect_user_info() {
    local current_user uid groups level
    current_user="${USER:-}"

    # 如果 USER 未设置则使用备用方法
    if [ -z "$current_user" ]; then
        current_user=$(whoami 2>/dev/null || printf 'unknown')
    fi

    # 如果 id 命令可用则获取 UID 和用户组
    uid="unknown"
    groups="unknown"
    if command -v id >/dev/null 2>&1; then
        uid=$(id -u "$current_user" 2>/dev/null || id -u 2>/dev/null || printf 'unknown')
        groups=$(id -Gn "$current_user" 2>/dev/null || id -Gn 2>/dev/null || printf 'unknown')
    fi

    # 确定权限级别
    level="user"
    if [ "$uid" = "0" ]; then
        level="root"
    elif printf '%s' "$groups" | grep -Eq '(^|[[:space:]])(sudo|wheel|admin)([[:space:]]|$)'; then
        level="sudoer"
    fi

    printf 'User=%s uid=%s level=%s Groups=%s' "$current_user" "$uid" "$level" "$groups"
}

# 从 JSON 文件中提取命令内容
# 参数：$1 - JSON 文件路径
# 返回：命令内容到 stdout
_fuck_extract_command_from_json() {
    local json_file="$1"
    if command -v python3 >/dev/null 2>&1; then
        python3 - "$json_file" <<'PY'
import json, sys
path = sys.argv[1]
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)
choices = data.get('choices') or []
if not choices:
    sys.exit(1)
message = choices[0].get('message') or {}
content = (message.get('content') or '').strip()
if not content:
    sys.exit(1)
print(content)
PY
        return
    fi

    if command -v node >/dev/null 2>&1; then
        node - "$json_file" <<'JS'
const fs = require('fs');
const path = process.argv[1];
const data = JSON.parse(fs.readFileSync(path, 'utf8'));
const choice = (data.choices && data.choices[0]) || {};
const message = choice.message || {};
const content = (message.content || '').trim();
if (!content) {
  process.exit(1);
}
console.log(content);
JS
        return
    fi

    echo -e "${C_RED}Cannot parse AI response: neither python3 nor node is available.${C_RESET}" >&2
    return 1
}

# Spinner 加载动画
# 参数：$1 - 进程 PID，$2 - 可选的前缀文本
_fuck_spinner() {
    local pid=$1
    local prefix="${2:-}"
    local delay=0.1
    local -a frames=("|" "/" "-" "\\")
    local frame_count=${#frames[@]}
    local frame_idx=0
    local has_prefix=0
    if [ -n "$prefix" ]; then
        has_prefix=1
    fi

    # 仅在 stderr 是终端时操作光标
    if [ -t 2 ]; then
        tput civis 2>/dev/null || printf "\033[?25l" >&2
    fi

    while kill -0 "$pid" 2>/dev/null; do
        if [ "$has_prefix" -eq 1 ]; then
            printf "\r%s%s" "$prefix" "${frames[$frame_idx]}"
        else
            printf " %s " "${frames[$frame_idx]}"
            printf "\b\b\b"
        fi
        frame_idx=$(( (frame_idx + 1) % frame_count ))
        sleep "$delay"
    done

    if [ "$has_prefix" -eq 1 ]; then
        printf "\r%s" "$prefix"
        tput el 2>/dev/null || printf "\033[K"
    else
        printf "   \b\b\b"
    fi

    if [ -t 2 ]; then
        tput cnorm 2>/dev/null || printf "\033[?25h" >&2
    fi
}

# 初始化历史文件
# 参数：$1 - 历史文件路径（可选，默认 $INSTALL_DIR/history.json）
_fuck_init_history_file() {
    local history_file="${1:-$INSTALL_DIR/history.json}"

    if [ ! -f "$history_file" ]; then
        cat > "$history_file" <<'HISTORY_EOF'
{
  "version": "1.0.0",
  "commands": [],
  "favorites": []
}
HISTORY_EOF
        chmod 600 "$history_file"
    fi
}

# 记录命令执行到历史
# 参数：$1 - 提示词，$2 - 命令，$3 - 退出码（可选），$4 - 耗时（可选）
_fuck_log_history() {
    local prompt="$1"
    local command="$2"
    local exit_code="${3:-0}"
    local duration="${4:-0}"

    local history_file="$INSTALL_DIR/history.json"

    # 检查 jq 是否可用
    if ! command -v jq &> /dev/null; then
        return 1
    fi

    # 初始化历史文件
    _fuck_init_history_file "$history_file"

    # 生成唯一 ID
    local cmd_id="cmd_$(date +%s)_$$"
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u +"%Y-%m-%dT%H:%M:%S" 2>/dev/null || echo "unknown")

    # 创建条目
    local entry
    entry=$(jq -n \
        --arg id "$cmd_id" \
        --arg timestamp "$timestamp" \
        --arg prompt "$prompt" \
        --arg command "$command" \
        --argjson exit_code "$exit_code" \
        --argjson duration "$duration" \
        '{
            id: $id,
            timestamp: $timestamp,
            prompt: $prompt,
            command: $command,
            exitCode: $exit_code,
            duration: $duration
        }' 2>/dev/null)

    if [ -z "$entry" ]; then
        return 1
    fi

    # 追加到历史并限制为 1000 条（避免竞态条件）
    local temp_file="${history_file}.tmp"
    if jq ".commands += [$entry] | .commands |= .[-1000:]" "$history_file" > "$temp_file" 2>/dev/null; then
        command mv -f -- "$temp_file" "$history_file"
        chmod 600 "$history_file"
    else
        rm -f "$temp_file"
    fi
}

