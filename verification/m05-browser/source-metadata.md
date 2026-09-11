# M05 browser verification source lock

- Harness checkpoint: `1500f48`
- M05 fixture repair commit: `18b6aa1`
- Latest-main M05 repair commit: `37e3de2`
- Latest-main harness commit: `69ec964`
- Isolated harness dependency commits: `b0ec63f`, `a730ee5`
- Latest `origin/main` at publication: `c3c1220c4e2e7bdce8e8d99e057536c3c0f1a9bc`
- Fresh `origin/main` checked for cleanup follow-up:
  `455bafc9323b67c1e3eda031603b22d78ae49049`
- PR #143 merge / publish base: `8e7baf8a3e156f7dc3666313fb7c88d7e6e7d8df`
- Cleanup and documentation repair commit: `1381ac9`
- M05 path: `examples/python-secure-coding-8h-priority-labs/m05_web_context`
- M05 blobs at start:
  - `__init__.py`: `8565980e0af688a06b02ca2ada33fc57e7d1a09e`
  - `common.py`: `2867c69e18b64ef04d7c04f9d03fac6d4f796274`
  - `instructor.md`: `0e45889c3d7d5eef425b24e683685c7c6a5ed950`
  - `learner.md`: `c4e0c94aa63f29b2b47514abc8d172459e2d0f12`
  - `secure.py`: `6cf4ca12d17fa0fde90075fcac2569cd27f27e2c`
  - `test_m05.py`: `dbbf5a93e58adc8c0fd637b909b7dc6abbea5fcc`
  - `verification-record.md`: `64884b7caa42da9d9c710117f4e9a552f12c004a`
  - `vulnerable.py`: `89225a922df2a9409018bd12d748136937bdc7ff`

- Follow-up candidate blobs:
  - `secure.py`: `67a890aba2fd68253bd8fe43b8813220ea818223`
  - `run-browser-verification.mjs`: `0a6d2553e90f7cfa3f2eca75f29a89bb5b692cd0`
  - `lifecycle.mjs`: `c407344d4e42fbf7c4c7c83dd7260af05e0a37e6`
  - `cleanup-regression.mjs`: `b64cbadca72a0125bb9a05a8fcb1072261cb86ce`

The M05 repair is limited to an explicit keyword-only `trusted_origin` service
configuration parameter with the original `https://app.local` default, plus a
focused regression test for exact override and rejection of another Origin.
The browser fixture uses it only to bind the HTTP recovery fixture to its
actual server-owned `http://app.local` origin. The follow-up also bounds
harness cleanup and corrects current M05/instructor 7/50 expectation wording
while preserving historical 6/49 provenance. No Python CI workflow, canonical
Q36/Foundation, product runtime/schema, or root product dependency file is
changed by this worktree. The HTTP browser result remains partial because
HTTPS Secure/SameSite coverage is `NOT_RUN`.
