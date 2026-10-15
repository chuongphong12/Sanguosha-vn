# Delivery roadmap

## Engine

See the [current Hegemony port plan](../plans/hegemony-port.md) for completed library boundaries and remaining production gates. Part 4y adds [isolated SkillCard onUse](../engine/skill-card-on-use.md); the next dependency is shared SkillCard GameRule/resource/effect execution, followed by admission/response integration. This checkpoint does not enable production SkillCards.

## Knowledge migration

Canonical requirements: [spec #10](https://github.com/chuongphong12/Sanguosha-vn/issues/10). Approved dependent slices: [curation #11](https://github.com/chuongphong12/Sanguosha-vn/issues/11), [subtree #12](https://github.com/chuongphong12/Sanguosha-vn/issues/12), [bootstrap and checkout #13](https://github.com/chuongphong12/Sanguosha-vn/issues/13), [validation and provisioning #14](https://github.com/chuongphong12/Sanguosha-vn/issues/14).

The curation baseline is in [metadata](../source-baseline.json), and every old tracked document is accounted for in the [migration manifest](../research/migration-manifest.json). The source baseline identifies inspected input, not a claim that all later changes remain covered. Publication status and executed migration checks belong to the migration checkpoint, not this durable rules index.
