# Tool integrations

The Tools page contains 24 tools in four sections. Chat advertises 14 callable
functions: Nmap, Nikto, and all twelve additions below. All dedicated routes run
in the Node.js runtime and stream plain-text output. CLI output is followed by
artifact paths when a tool creates files; execution failures include a
`[SPECTRE_ERROR]` line, which the Tools page treats as a failed run.

| Route | Groq function | Input fields | Runtime requirement |
| --- | --- | --- | --- |
| `/api/tools/mobsf` | `run_mobsf` | `filePath`, `mode` (`static` or `dynamic`) | MobSF REST service and API key |
| `/api/tools/drozer` | `run_drozer` | `target`, `module` | Drozer CLI and a reachable Android agent |
| `/api/tools/frida` | `run_frida` | `target`, `script` | Frida CLI and a USB-connected app/device |
| `/api/tools/objection` | `run_objection` | `target`, `command` | Current Objection CLI and a USB-connected app/device |
| `/api/tools/jadx` | `run_jadx` | `apkPath`, `outputDir` | JADX and a Java runtime |
| `/api/tools/apktool` | `run_apktool` | `apkPath`, `mode` (`decode` or `build`) | APKTool and a Java runtime |
| `/api/tools/ghidra` | `run_ghidra` | `binaryPath`, `scriptPath` | Ghidra `support/analyzeHeadless` and its required JDK |
| `/api/tools/burp` | `run_burp` | `target` | Burp Suite Professional with REST API enabled |
| `/api/tools/nessus` | `run_nessus` | `target`, `policyId` (string) | Nessus REST API with scan permissions and an existing policy |
| `/api/tools/nuclei` | `run_nuclei` | `target`, optional `templates` | Nuclei and installed templates |
| `/api/tools/credential-audit` | `run_credential_audit` | `target`, `service`, `wordlist` | Hydra and a local password wordlist |
| `/api/tools/protocol-audit` | `run_protocol_audit` | `target` | Enum4linux-ng |

Copy the applicable settings from [`.env.local.example`](../.env.local.example)
into the local server environment, then restart Next.js. CLI binaries can be
selected with their `SPECTRE_*_BIN` variables. The metadata endpoint uses the
same overrides as execution. REST tools show as available when their endpoint
and credentials are configured; this does not assert service health, licensing,
or device connectivity.

## Scope

`SPECTRE_TARGET_SCOPE` optionally limits network tools to exact hostnames, wildcard
subdomains, or IP CIDRs. `SPECTRE_TARGET_BLOCKLIST` takes precedence. CIDRs must
fit entirely within an allowed network and must not overlap a blocked network.
Loopback, unspecified, and link-local addresses, including common URL aliases
and IPv4-mapped IPv6 forms, are blocked. Resolved target addresses are checked
before execution. Private lab networks are supported. Scope matching checks the
requested hostname and resolved addresses; downstream tools still perform their
own network connections and DNS resolution.

`SPECTRE_APP_SCOPE` and `SPECTRE_APP_BLOCKLIST` govern Frida/Objection process
identifiers. `SPECTRE_TOOL_ROOTS` limits files, scripts, template paths and output
directories, following symlinks before checking scope. It defaults to the project
root. `SPECTRE_TOOL_PATH_BLOCKLIST` excludes paths within those roots. Credential
wordlists may also come from `/usr/share/wordlists`. Local paths refer to the
server running SPECTRE. API service endpoints are configured separately and may
use loopback, as these are control-plane connections rather than scan targets.

## Execution details

Every adapter uses `child_process.spawn` with `shell: false`, streams stdout and
stderr, and returns a typed result with `output`, `exitCode`, optional parsed
`data`, and optional `artifacts`. Nuclei JSON Lines and REST results are parsed.
REST tools run the bundled Node.js adapter, which uploads/starts actual jobs,
polls their status, and prints JSON Lines progress and findings. API keys stay
in the child environment and are redacted from adapter output. TLS certificate
validation remains enabled; use a trusted CA or `NODE_EXTRA_CA_CERTS` for Nessus
installations with a private CA.

Cancellation and timeouts terminate the process group, followed by a forced kill
after three seconds if needed. The REST adapter also attempts to stop Android
MobSF/Nessus jobs or pause Burp jobs when interrupted; it reports if remote
cancellation cannot be confirmed. iOS instrumentation/device lifecycle remains
managed by MobSF. Native tools generally time out after 3–15 minutes; Burp and
Nessus allow up to 30 minutes. Frida observes its loaded script for 30 seconds.

MobSF runs static analysis before a dynamic session. Android uses the configured
MobSF device/emulator and the dynamic start/stop/report endpoints. IPA dynamic
analysis uses MobSF's jailbroken iOS device APIs and requires
`SPECTRE_MOBSF_IOS_DEVICE_ID`. The observation window defaults to 30 seconds and
can be set with `SPECTRE_MOBSF_DYNAMIC_SECONDS`. Device prerequisites and app
compatibility are handled by MobSF and reported in the stream.

Drozer accepts a module plus arguments, for example
`app.package.attacksurface -a com.example.app`. Frida accepts a process name or
PID and an existing JavaScript file. Objection uses its `run` command for a single
invocation; hook lifetime is tied to that invocation.

JADX requires a new output directory. APKTool build mode takes a decoded
directory containing `apktool.yml`; decode takes an APK. APKTool and Ghidra
allocate unique output paths under `data/tool-output`, or
`SPECTRE_TOOL_OUTPUT_DIR`. Existing paths are not overwritten. Ghidra retains its
project and runs the requested local post-analysis script.

Credential auditing takes `username@host[:port]`, or uses
`SPECTRE_AUDIT_USERNAME` when the username is omitted. It supports SSH, FTP, SMB,
RDP, HTTP/HTTPS GET authentication, MySQL and PostgreSQL, with service ports,
two workers, and a delay between connections. Nuclei accepts comma-separated
local template files/directories; omitted templates use the installed library.

## Verification

`npm test` uses real child processes and a local HTTP fixture server to check
arguments, streaming, structured results, scope rejection, failure handling,
forced timeouts, cancellation, REST workflows and all 14 Groq dispatch paths.
It does not scan external hosts or require installed commercial tools/devices.
Live scans require the corresponding configured services and equipment.
