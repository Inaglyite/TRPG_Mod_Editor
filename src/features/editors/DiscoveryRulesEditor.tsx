import { Plus, Trash2 } from "lucide-react";
import type {
  DiscoveryFallbackDefinition,
  DiscoveryRuleDefinition,
} from "../../domain/types";
import { useEditorStore } from "../../store/editor-store";
import { FlagConditions } from "./FlagConditions";
import { FormField } from "./FormControls";

const intents = {
  examine: "观察",
  search: "搜索",
  read: "阅读",
  take: "拿取",
  talk: "交谈",
  enter: "进入",
  use: "使用",
};
const fallbackDefault: DiscoveryFallbackDefinition = {
  mode: "grant_clue",
  clue_id: null,
  narrative: "",
  cost_clock: null,
  cost_amount: 0,
};

export function DiscoveryRulesEditor({ id }: { id: string }) {
  const project = useEditorStore((state) => state.project);
  const update = useEditorStore((state) => state.updateClue);
  const apply = useEditorStore((state) => state.applyProjectEdit);
  const clue = project.module.clues[id];
  if (!clue) return null;
  const patch = (index: number, changes: Partial<DiscoveryRuleDefinition>) =>
    update(id, {
      ...clue,
      discovery_rules: clue.discovery_rules.map((rule, i) =>
        i === index ? { ...rule, ...changes } : rule,
      ),
    });
  const essential =
    project.module.progression?.essential_clue_ids.includes(id) ?? false;
  return (
    <section className="form-section">
      <div className="section-heading">
        <h2>发现与主线推进</h2>
        <button
          className="secondary-button"
          onClick={() =>
            update(id, {
              ...clue,
              discovery_rules: [
                ...clue.discovery_rules,
                {
                  intent: "examine",
                  targets: [clue.source || clue.text || id],
                  approach_text: "",
                  skill: null,
                  check_type: null,
                  difficulty: "regular",
                  requires_success: false,
                  sanity_severity: null,
                  npc_reveals: [],
                  fallback: null,
                },
              ],
            })
          }
        >
          <Plus size={14} /> 添加发现规则
        </button>
      </div>
      <p className="section-help">
        描述调查员做什么、针对什么目标，以及检定失败后如何继续。
      </p>
      {project.module.format_version === "2.0" && (
        <label className="switch-row">
          <input
            type="checkbox"
            checked={essential}
            onChange={(event) => {
              const next = structuredClone(project);
              const ids = new Set(
                next.module.progression?.essential_clue_ids ?? [],
              );
              if (event.target.checked) ids.add(id);
              else ids.delete(id);
              next.module.progression = { essential_clue_ids: [...ids] };
              apply(next);
            }}
          />
          这是推进故事必需的主线线索
        </label>
      )}
      {clue.discovery_rules.map((rule, index) => (
        <div className="rule-card" key={index}>
          <div className="section-heading">
            <h3>发现方式 {index + 1}</h3>
            <button
              className="quiet-button"
              aria-label={`删除发现规则 ${index + 1}`}
              onClick={() =>
                update(id, {
                  ...clue,
                  discovery_rules: clue.discovery_rules.filter(
                    (_, i) => i !== index,
                  ),
                })
              }
            >
              <Trash2 size={15} />
            </button>
          </div>
          <div className="form-grid">
            <FormField label="调查动作">
              <select
                value={rule.intent}
                onChange={(event) =>
                  patch(index, {
                    intent: event.target
                      .value as DiscoveryRuleDefinition["intent"],
                  })
                }
              >
                {Object.entries(intents).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              label="调查目标"
              hint="用英文逗号分隔，例如：书桌, 借阅卡"
            >
              <input
                defaultValue={rule.targets.join(", ")}
                key={rule.targets.join(",")}
                onBlur={(event) =>
                  patch(index, {
                    targets: event.target.value
                      .split(",")
                      .map((value) => value.trim())
                      .filter(Boolean),
                  })
                }
              />
            </FormField>
            <FormField label="方式说明" wide>
              <input
                defaultValue={rule.approach_text}
                key={rule.approach_text}
                onBlur={(event) => {
                  if (event.target.value !== rule.approach_text)
                    patch(index, { approach_text: event.target.value });
                }}
              />
            </FormField>
            <FormField label="检定方式">
              <select
                value={rule.check_type ?? ""}
                onChange={(event) =>
                  patch(index, {
                    check_type:
                      (event.target
                        .value as DiscoveryRuleDefinition["check_type"]) ||
                      null,
                    skill:
                      event.target.value === "skill"
                        ? rule.skill || "侦查"
                        : null,
                  })
                }
              >
                <option value="">无需检定</option>
                <option value="skill">技能检定</option>
                <option value="luck">幸运检定</option>
              </select>
            </FormField>
            <FormField label="检定难度">
              <select
                value={rule.difficulty}
                onChange={(event) =>
                  patch(index, {
                    difficulty: event.target
                      .value as DiscoveryRuleDefinition["difficulty"],
                  })
                }
              >
                <option value="regular">普通</option>
                <option value="hard">困难</option>
                <option value="extreme">极难</option>
              </select>
            </FormField>
            {rule.check_type === "skill" && (
              <FormField label="检定技能">
                <input
                  defaultValue={rule.skill ?? ""}
                  key={rule.skill}
                  onBlur={(event) =>
                    patch(index, { skill: event.target.value.trim() || null })
                  }
                />
              </FormField>
            )}
            <FormField label="理智冲击">
              <select
                value={rule.sanity_severity ?? ""}
                onChange={(event) =>
                  patch(index, {
                    sanity_severity:
                      (event.target
                        .value as DiscoveryRuleDefinition["sanity_severity"]) ||
                      null,
                  })
                }
              >
                <option value="">无</option>
                <option value="minor">轻微</option>
                <option value="moderate">中等</option>
                <option value="major">严重</option>
              </select>
            </FormField>
          </div>
          <label className="switch-row">
            <input
              type="checkbox"
              checked={rule.requires_success}
              onChange={(event) =>
                patch(index, { requires_success: event.target.checked })
              }
            />
            只有检定成功才发现
          </label>
          <div className="form-grid" style={{ marginTop: 16 }}>
            <FormField label="失败替代路径">
              <select
                value={rule.fallback?.mode ?? ""}
                onChange={(event) =>
                  patch(index, {
                    fallback: event.target.value
                      ? {
                          ...fallbackDefault,
                          ...rule.fallback,
                          mode: event.target
                            .value as DiscoveryFallbackDefinition["mode"],
                          clue_id:
                            event.target.value === "alternate_clue"
                              ? (rule.fallback?.clue_id ?? null)
                              : null,
                        }
                      : null,
                  })
                }
              >
                <option value="">不设置</option>
                <option value="grant_clue">仍获得这条线索</option>
                <option value="alternate_clue">获得另一条线索</option>
              </select>
            </FormField>
            {rule.fallback?.mode === "alternate_clue" && (
              <FormField label="替代线索">
                <select
                  value={rule.fallback.clue_id ?? ""}
                  onChange={(event) =>
                    patch(index, {
                      fallback: {
                        ...rule.fallback!,
                        clue_id: event.target.value || null,
                      },
                    })
                  }
                >
                  <option value="">选择一条线索</option>
                  {Object.entries(project.module.clues)
                    .filter(([otherId]) => otherId !== id)
                    .map(([otherId, other]) => (
                      <option key={otherId} value={otherId}>
                        {other.text}
                      </option>
                    ))}
                </select>
              </FormField>
            )}
            {rule.fallback && (
              <>
                <FormField label="失败叙事" wide>
                  <textarea
                    rows={3}
                    defaultValue={rule.fallback.narrative}
                    key={rule.fallback.narrative}
                    onBlur={(event) =>
                      patch(index, {
                        fallback: {
                          ...rule.fallback!,
                          narrative: event.target.value,
                        },
                      })
                    }
                  />
                </FormField>
                <FormField label="推进案件时钟">
                  <select
                    value={rule.fallback.cost_clock ?? ""}
                    onChange={(event) =>
                      patch(index, {
                        fallback: {
                          ...rule.fallback!,
                          cost_clock: event.target.value || null,
                        },
                      })
                    }
                  >
                    <option value="">不推进时钟</option>
                    {Object.keys(project.module.initial_state.case_clocks).map(
                      (name) => (
                        <option key={name}>{name}</option>
                      ),
                    )}
                  </select>
                </FormField>
                <FormField label="时钟代价">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={rule.fallback.cost_amount}
                    key={rule.fallback.cost_amount}
                    onBlur={(event) => {
                      const amount = event.target.valueAsNumber;
                      if (
                        Number.isInteger(amount) &&
                        amount >= 0 &&
                        amount <= 100
                      )
                        patch(index, {
                          fallback: { ...rule.fallback!, cost_amount: amount },
                        });
                    }}
                  />
                </FormField>
              </>
            )}
          </div>
        </div>
      ))}
      {!clue.discovery_rules.length && (
        <p className="inline-help">
          添加发现方式，让调查员能通过行动找到这条线索；开局已知的线索可以不设规则。
        </p>
      )}
      <div style={{ marginTop: 20 }}>
        <FlagConditions
          label="发现后的旗标变化"
          value={clue.flag_effects}
          declared={project.module.initial_state.flags}
          onChange={(flags) => update(id, { ...clue, flag_effects: flags })}
        />
      </div>
      <FormField label="发现后获得的物品">
        <input
          defaultValue={clue.granted_item ?? ""}
          key={clue.granted_item}
          placeholder="可选，如：地下库房钥匙"
          onBlur={(event) => {
            const granted = event.target.value.trim() || null;
            if (granted !== clue.granted_item)
              update(id, { ...clue, granted_item: granted });
          }}
        />
      </FormField>
    </section>
  );
}
