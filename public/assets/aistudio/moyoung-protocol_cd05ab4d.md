---
title: Moyoung Protocol
search:
  boost: 0.5
---

# Moyoung Protocol

The Moyoung protocol is used by [a lot of smart watches](../../gadgets/wearables/moyoung.md) managed by the Da Fit app and by COLMI Fit.

There are two versions of the protocol, V1 and V2. This description is based on comments in [MoyoungConstants.java](https://codeberg.org/Freeyourgadget/Gadgetbridge/src/branch/master/app/src/main/java/nodomain/freeyourgadget/gadgetbridge/devices/moyoung/MoyoungConstants.java){: target="_blank" } and the [Wireshark dissector](https://codeberg.org/Freeyourgadget/Gadgetbridge-tools/src/branch/main/moyoung/wireshark){: target="_blank" }.

Protocol version is determined by reading manufacturer name. MOYOUNG for old fixed-size or MOYOUNG-V2 for MTU. The non-MTU version uses packets of size 256 for firmware >= 1.6.5, and 64 otherwise.

## Moyoung V2 Format

```
fe ea 20 0a 31 68a3100308
|  |  |  |  |  +-- payload
|  |  |  |  +----- command
|  |  |  +-------- size low byte
|  |  +----------- size high byte + 32
+--+-------------- UUID 0xfeea
```

The device communicates by writing to `UUID_CHARACTERISTIC_DATA_OUT` in MTU-sized chunks. The value of MTU seems to be somehow changeable (?), but the default is 20. Responses are received via notify on `UUID_CHARACTERISTIC_DATA_IN` in similar format. The write success notification comes AFTER the responses.

The `size` value includes the UUID, size and command bytes, so a command with no payload comes with `size=5`.

## Commands

The `command` byte defines the basic action. The command structure has grown historically, thus is not very consequential. Some commands come as a pair of "set" and "get", where get is `0x10` higher than set, e.g:

 - `0x11` set alarms
 - `0x21` get alarms

Typically, a "get" request doesn't have a payload, and its comes with the same command byte and the payload appended.

Furthermore, there are multiple commands that have a sub-command, and even a sub-sub-command, e.g.:

 - Workout commands
     - `0xb2 00` workout list request
     - `0xb2 01` workout list response
 - Advanced command (`0xb9`) sub-command eCard (`0x12`):
     - `0xb9 12 00 02` eCard config request
     - `0xb9 12 00 03` eCard content request

Generally, `0xb9` seems to be the "advanced command" with further functions, where the sub-command also follows the `get=set+0x10` convention.

The Workout command `0xb2` does not have a "set" counterpart, but its requests and responses have different sub-command values (incremented by 1).

## Watch Faces

The upload / download of watch faces is not supported by Gadgetbridge, but there are other FOSS tools:

- [DaFup](https://github.com/VicGuy/DaFup){: target="_blank" } - UI/CLI uploader for MoYoung v2 watch face files (Python)
- [extrathundertool](https://github.com/david47k/extrathundertool){: target="_blank" } - encoder / decoder for watch face files (Rust)
