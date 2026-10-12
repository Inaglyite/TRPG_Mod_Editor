import { createDefaultProject } from "../src/domain/default-project";
import type { ClueDefinition, NpcDefinition } from "../src/domain/types";

export function authoringFixture() {
  const project = createDefaultProject();
  Object.assign(project.manifest, {
    id: "local.whispering_archive",
    title: "低语档案馆",
    description:
      "一座长期封存的城市档案馆，近期传出异常的低语声。调查员受邀前往整理一批尘封档案，却发现建筑与一段被遗忘的历史。",
    author: "档案员",
    license: "CC-BY-4.0",
    tags: ["都市", "神秘", "调查"],
  });
  const opening = project.module.scenes.opening_scene;
  Object.assign(opening, {
    name: "档案馆门厅",
    description:
      "高窗漏下冷蓝色的月光。旧木桌上，一盏黄铜台灯照亮了摊开的访客登记簿。",
    exits: ["reading_room"],
    npcs_present: ["archivist"],
  });
  project.module.scenes.reading_room = {
    ...structuredClone(opening),
    name: "阅览室",
    description: "一排排书架藏在暗处，只有借阅柜台的铃铛还在轻轻震动。",
    exits: ["opening_scene", "basement"],
    npcs_present: [],
  };
  project.module.scenes.basement = {
    ...structuredClone(opening),
    name: "地下库房",
    description: "石阶通向一道紧锁的门。门后传来纸张翻动的声音。",
    exits: ["reading_room"],
    npcs_present: [],
  };
  const npc: NpcDefinition = {
    name: "魏明远",
    visible_tags: ["谨慎", "档案管理员"],
    secret: "NPC_SECRET_SENTINEL：他藏起了地下库房的钥匙。",
    hp: 10,
    max_hp: 10,
    disposition: "neutral",
    current_location: "opening_scene",
    attributes: { INT: 70 },
    skills: { 图书馆使用: 75 },
    conditions: [],
    spells: [],
    notes: "NOTES_SECRET_SENTINEL",
    asset_id: null,
    initial_reveal: 1,
    initial_reveal_entries: [],
    extensions: { author_note: "preserved" },
  };
  project.module.npcs.archivist = npc;
  project.module.npcs.visitor = {
    ...structuredClone(npc),
    name: "陌生访客",
    current_location: "reading_room",
  };
  const clue: ClueDefinition = {
    text: "泛黄的借阅卡",
    category: "investigation",
    type: "hidden",
    tier: 2,
    source: "借阅柜台",
    related_npcs: [],
    related_scenes: ["opening_scene"],
    asset_id: null,
    granted_item: null,
    flag_effects: {},
    discovery_rules: [],
    initially_known: false,
    discovery_notes: "DISCOVERY_SECRET_SENTINEL：搜索柜台背面。",
    extensions: {},
  };
  project.module.clues.card = clue;
  project.module.clues.known = {
    ...structuredClone(clue),
    text: "委托信：整理尘封档案",
    initially_known: true,
    discovery_notes: "",
  };
  project.module.initial_state.known_clue_ids = ["known"];
  project.module.initial_state.flags = { archive_unlocked: false };
  project.module.initial_state.case_clocks = { danger: 0 };
  project.module.endings.truth = {
    title: "被掩埋的真相",
    trigger: "调查员找到地下档案",
    description: "天亮时，低语终于停止了。",
    ending_type: "good",
    required_flags: {},
  };
  return project;
}
