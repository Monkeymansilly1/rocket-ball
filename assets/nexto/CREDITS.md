# Nexto policy

Official Nexto trained policy by the Necto/Nexto contributors:
https://github.com/Rolv-Arild/Necto/tree/2e6ed7d6ed2b352e8ff529d4a12a0c9c70c28cca/rlbot-support/Nexto

The original model, observation builder and discrete action table are licensed
**CC BY-NC-SA 4.0** (attribution, noncommercial, share alike); see LICENSE.txt.
These terms apply to the Nexto component and its adapted observation/action code.

The unchanged trained weights were exported from TorchScript to ONNX with
`tools/export-nexto.py`. No weights were retrained. Source model SHA-256:
`bf5343b5eeacac6bf7cdb75dac4a5c14ba0f94d820eae75f00a211b6119d69fa`.

`lib/nexto/adapter.js` adapts upstream observations/actions to this custom arena.
`nexto.onnx` runs in a Web Worker through ONNX Runtime Web 1.17.3 (MIT), bundled
under `lib/nexto/vendor` with its license and third-party notices.

Nexto was trained for Rocket League physics. Performance and playing strength
in this custom simulator can differ; the UI labels this mode experimental.
