# Releasing and updating

How a version gets from a git tag to every installed copy, what has to be set
up once, and what to do when a release goes wrong.

---

## How it works

```
git tag v1.2.0  ──▶  release.yml on a Windows runner
                       │  refuses the tag if it disagrees with the version
                       │  runs every check (nothing ships past a red test)
                       │  builds the NSIS installer and the MSI
                       │  signs them with Authenticode, if configured
                       │  signs the update with the updater key (always)
                       ▼
                     GitHub Release v1.2.0
                       ├── Program_1.2.0_x64-setup.exe  (+ .sig)
                       ├── Program_1.2.0_x64_en-US.msi  (+ .sig)
                       └── latest.json   ◀── installed copies check this
                                              at launch and twice a day
```

An installed copy fetches `latest.json` from the latest release, and if it
names a newer version, offers it. When the user accepts, the program downloads
the installer, **verifies its signature against the public key compiled into
the program**, and only then runs it. The NSIS installer installs per user, so
updating needs no administrator rights; the program restarts on the new version.

An update whose signature does not verify is refused, and the program keeps
running the version it has. There is no switch to turn verification off: an
updater that installs unverified downloads is a way to run anyone's code on
every customer's machine.

---

## One-time setup

### The updater key (required)

`npm run init` generated a keypair for the program:

- the **public key** is in `src-tauri/tauri.conf.json` (`plugins.updater.pubkey`),
  and is compiled into every build;
- the **private key** is at `~/.tauri/<identifier>.key`, and its **password**
  was printed once.

Give both to the release workflow as repository secrets (Settings → Secrets
and variables → Actions), or with the GitHub CLI:

```bash
# macOS / Linux
gh secret set TAURI_SIGNING_PRIVATE_KEY --repo owner/program < ~/.tauri/com.acme.program.key
# Windows PowerShell
Get-Content -Raw "$HOME\.tauri\com.acme.program.key" | gh secret set TAURI_SIGNING_PRIVATE_KEY --repo owner/program

gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD --repo owner/program   # paste the password
```

Keep the key file and the password in a password manager as well. **If either
is lost, the installed copies can never be updated again**: they only accept
updates signed with that key, and a new key means everyone has to download and
install the program by hand. If the key leaks, anyone holding it can push code
to every installed copy: generate a new pair, ship it in a release signed with
the old key, and only then retire the old one.

### Code signing (strongly recommended)

Without an Authenticode signature, Windows SmartScreen shows people an
"unrecognized app" warning when they run the installer. The program works
either way, and the release workflow publishes unsigned installers until a
signing secret exists, but the warning costs installs.

Since June 2023, code signing keys must be kept in hardware: a USB token or a
cloud HSM. A new certificate therefore usually cannot be exported to a `.pfx`
file for CI; it is used through the provider's signing service instead. The
workflow supports both routes through `scripts/sign-windows.ps1`:

| Secret | For |
|---|---|
| `WINDOWS_SIGN_COMMAND` | A cloud signing command line, with `%1` standing for the file. Azure Artifact Signing (formerly Trusted Signing), DigiCert KeyLocker, SSL.com eSigner and others provide a command-line signer for this. If the tool is not on the runner, add a step to `release.yml` that installs it before the build. |
| `WINDOWS_CERTIFICATE`, `WINDOWS_CERTIFICATE_PASSWORD` | A certificate that can be exported: the `.pfx` file base64-encoded (`[Convert]::ToBase64String([IO.File]::ReadAllBytes('cert.pfx'))`) and its password. Signed with SHA-256 and an RFC 3161 timestamp, so signatures outlive the certificate. |

Rough costs, as of this writing: Azure Artifact Signing is a monthly
subscription of around $10 (available to organisations and, in some regions,
individuals); an OV certificate from a certificate authority is around
$200–400 a year, plus the provider's cloud signing service or a hardware token.
EV certificates cost more; Microsoft has said they no longer skip SmartScreen's
reputation building, so a new program's first downloads may still see a warning
until it has a download history whichever kind is used.

---

## Cutting a release

```bash
npm run version:set -- 1.2.0     # writes the version into all five files
git commit -am "Release 1.2.0"
git tag v1.2.0
git push --follow-tags
```

Watch it under the repository's **Actions** tab. When it finishes, the release
is on the **Releases** page. Installed copies check about ten seconds after
they start, and every twelve hours while they keep running, unless the user
has turned automatic checks off in Settings.

Versions are plain `major.minor.patch`, at most `255.255.65535`. The MSI format
cannot represent anything else, so `npm run version:set` refuses a
pre-release suffix like `1.2.0-beta`.

### Before announcing a release

The CI build of every push attaches an unsigned installer to its run, which is
the quickest way to try a change on a Windows PC. For a release itself, it is
worth one real update before telling anyone:

1. Install the previous release's installer on a Windows PC.
2. Launch it, open Settings, and choose **Check now**. It should offer the new
   version, install it and restart.
3. Open Settings again and check the version.

### Reviewing before publishing

The workflow publishes immediately, because installed copies can only see
published releases. To review first, set `releaseDraft: true` in
`release.yml`; the release then waits as a draft until someone publishes it on
the Releases page, and updates reach people only from that moment.

---

## When a release is bad

Updates only move forward: an installed copy never downgrades itself. So a bad
release is fixed by releasing a better one.

1. Fix the problem, then `npm run version:set -- 1.2.1`, commit, tag, push.
2. If the bad version is doing damage in the meantime, delete its GitHub
   Release (not the tag). Copies that have not updated yet then see the
   previous release as the latest and stay where they are. Copies that already
   have the bad version keep it until 1.2.1 is out.

A customer stuck on a broken build can always install the previous version from
the Releases page by hand. Their settings and data survive, because they are
stored under the program's identifier, not in the install folder.

---

## Secrets reference

| Secret | Required | Set by |
|---|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | yes | the key file from `npm run init` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | yes | the password `npm run init` printed |
| `WINDOWS_SIGN_COMMAND` | no | a cloud signing command, `%1` = the file |
| `WINDOWS_CERTIFICATE` | no | a base64 `.pfx`, for certificates that allow export |
| `WINDOWS_CERTIFICATE_PASSWORD` | with the above | that certificate's password |

The CI workflow uses no secrets at all, so it runs the same for forks and pull
requests.
