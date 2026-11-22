# LMSpeed Models — rust

Source-attributed model specifications with explicit canonical aliases, offline loading and refresh. Package releases are being prepared; consult [release status and examples](https://github.com/LMSpeed/models#readme).

This SDK supports schema major 1. Data revisions are independent of SDK versions. Unknown values remain null, unavailable type sections are absent, and false and zero remain explicit. Failed refreshes preserve the last loaded catalogue. No background requests run on import.

See [the common contract and usage examples](https://github.com/LMSpeed/models#readme), [field-source attribution](https://github.com/LMSpeed/models/blob/main/data/NOTICE.md), and [MIT code license](https://github.com/LMSpeed/models/blob/main/LICENSE).
