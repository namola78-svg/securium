# M04 Instructor Guide

## Demonstration order

1. Create a temporary upload root and a sibling synthetic private file.
2. Run the path traversal assertion. Ask why `base / name` is not a security
   decision and why the final resolved object matters.
3. Show the upload example: filename, type, size, and storage location are
   separate controls. The server-generated name is not a replacement for
   content/type/size policy.
4. Start the loopback fixture. Let the vulnerable fetch reach it, then show
   that the secure path rejects the loopback address before opening it.
5. Explain the mocked allow-path test: resolver and opener injection isolates
   policy logic; it does not certify cloud/network egress.

## Common wrong answers

- “Strip `..` or slash characters”: alternate representations and filesystem
  resolution make blacklist filtering incomplete.
- “Check the extension/MIME header”: client metadata is advisory and does not
  establish content or authorization.
- “Allow `https`”: scheme syntax does not authorize a host, IP, port, redirect,
  timeout, or egress destination.
- “Check the first URL only”: redirects and DNS resolution can change the final
  destination.

## Check questions

- What is the postcondition for a file read?
- Why does the test use a generated name instead of sanitizing the client name?
- Which local assertion demonstrates SSRF impact without contacting an outside
  service?
- What is still required from infrastructure outside this Python function?
