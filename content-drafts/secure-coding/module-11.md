# Module 11 — Cryptography Basics

Time: 35 minutes

## Concept → Role → Skill → Tool/Technology

Purpose-fit cryptography → developer → choose primitives, randomness, and key lifecycle → platform crypto provider, KMS, TLS. Related certification: cryptography domain (conceptual only).

## Lesson

Hashing is one-way transformation for integrity or password-verifier construction; encryption is reversible with a key; signatures authenticate origin and integrity; MACs authenticate with a shared secret. Use vetted libraries and authenticated encryption for confidential data. Passwords need a slow, salted password-hashing function, not a fast general hash. Token randomness needs a cryptographic random source.

## Exercise

Choose hash, MAC, signature, or authenticated encryption for four scenarios and name the key-management question for each.

An unauthenticated hash does not prove who changed a message; use a MAC or signature when authenticity is required. Encryption is reversible with a key, while password verification uses a slow salted password-hashing function.

## Instructor notes

Focus on purpose and lifecycle. A strong algorithm with exposed keys is not a strong system.

## Learner takeaway

Cryptography is a protocol and key-management decision, not “encrypt everything.”
