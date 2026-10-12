import { Plus, Trash2 } from "lucide-react";
import type { EncounterDefinition } from "../../domain/types";
import { useEditorStore } from "../../store/editor-store";
import { FlagConditions } from "./FlagConditions";
import { FormField } from "./FormControls";

export function EncountersEditor({ id }: { id: string }) {
  const project = useEditorStore((state) => state.project);
  const update = useEditorStore((state) => state.updateScene);
  const scene = project.module.scenes[id];
  if (!scene) return null;
  const patch = (index: number, changes: Partial<EncounterDefinition>) =>
    update(id, {
      ...scene,
      encounters: scene.encounters.map((encounter, i) =>
        i === index ? { ...encounter, ...changes } : encounter,
      ),
    });
  return (
    <section className="form-section">
      <div className="section-heading">
        <h2>人物遭遇</h2>
        <button
          className="secondary-button"
          disabled={!Object.keys(project.module.npcs).length}
          onClick={() => {
            let count = scene.encounters.length + 1;
            while (
              scene.encounters.some(
                (encounter) => encounter.id === `encounter_${count}`,
              )
            )
              count++;
            update(id, {
              ...scene,
              encounters: [
                ...scene.encounters,
                {
                  id: `encounter_${count}`,
                  npc_id: Object.keys(project.module.npcs)[0],
                  availability: "guaranteed",
                  required_flags: {},
                  forbidden_flags: {},
                  luck_difficulty: "regular",
                  repeat: "once",
                  on_present_text: "",
                  on_absent_text: "",
                },
              ],
            });
          }}
        >
          <Plus size={14} /> 添加遭遇
        </button>
      </div>
      <p className="section-help">
        设置人物何时出现。固定在场人物可在上方直接勾选；条件出现的人物使用遭遇规则。
      </p>
      {scene.encounters.map((encounter, index) => (
        <div className="rule-card" key={encounter.id}>
          <div className="section-heading">
            <h3>{encounter.id}</h3>
            <button
              className="quiet-button"
              aria-label={`删除遭遇 ${encounter.id}`}
              onClick={() =>
                update(id, {
                  ...scene,
                  encounters: scene.encounters.filter((_, i) => i !== index),
                })
              }
            >
              <Trash2 size={15} />
            </button>
          </div>
          <div className="form-grid">
            <FormField label="遭遇人物">
              <select
                value={encounter.npc_id}
                onChange={(event) =>
                  patch(index, { npc_id: event.target.value })
                }
              >
                {Object.entries(project.module.npcs).map(([npcId, npc]) => (
                  <option value={npcId} key={npcId}>
                    {npc.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="出现方式">
              <select
                value={encounter.availability}
                onChange={(event) =>
                  patch(index, {
                    availability: event.target
                      .value as EncounterDefinition["availability"],
                  })
                }
              >
                <option value="guaranteed">必定出现</option>
                <option value="conditional">满足条件出现</option>
                <option value="luck">幸运检定决定</option>
                <option value="unavailable">不可出现</option>
              </select>
            </FormField>
            <FormField label="重复方式">
              <select
                value={encounter.repeat}
                onChange={(event) =>
                  patch(index, {
                    repeat: event.target.value as EncounterDefinition["repeat"],
                  })
                }
              >
                <option value="once">仅一次</option>
                <option value="always">每次进入</option>
              </select>
            </FormField>
            <FormField label="幸运难度">
              <select
                value={encounter.luck_difficulty}
                onChange={(event) =>
                  patch(index, {
                    luck_difficulty: event.target
                      .value as EncounterDefinition["luck_difficulty"],
                  })
                }
              >
                <option value="regular">普通</option>
                <option value="hard">困难</option>
                <option value="extreme">极难</option>
              </select>
            </FormField>
            <FormField label="出现时描述" wide>
              <textarea
                rows={3}
                defaultValue={encounter.on_present_text}
                key={encounter.on_present_text}
                onBlur={(event) =>
                  patch(index, { on_present_text: event.target.value })
                }
              />
            </FormField>
            <FormField label="未出现时描述" wide>
              <textarea
                rows={3}
                defaultValue={encounter.on_absent_text}
                key={encounter.on_absent_text}
                onBlur={(event) =>
                  patch(index, { on_absent_text: event.target.value })
                }
              />
            </FormField>
            <FlagConditions
              value={encounter.required_flags}
              declared={project.module.initial_state.flags}
              onChange={(flags) => patch(index, { required_flags: flags })}
            />
            <FlagConditions
              label="禁止旗标条件"
              value={encounter.forbidden_flags}
              declared={project.module.initial_state.flags}
              onChange={(flags) => patch(index, { forbidden_flags: flags })}
            />
          </div>
        </div>
      ))}
      {!scene.encounters.length && (
        <p className="small-muted">
          {Object.keys(project.module.npcs).length
            ? "暂无人物遭遇。"
            : "先从左侧创建人物，再安排他们的出现方式。"}
        </p>
      )}
    </section>
  );
}
