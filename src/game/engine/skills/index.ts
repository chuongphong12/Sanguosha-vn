import { registerSkill } from "../SkillRegistry";
import { yiJiSkill, jianXiongSkill, gangLieSkill, fanKuiSkill, yaoWuSkill } from "./damageSkills";
import { tuXiSkill, luoYiSkill, lianYingSkill, xiaoJiSkill } from "./phaseSkills";
import { fanJianSkill } from "./activeSkills";

export function registerAllSkills() {
  registerSkill(yiJiSkill);
  registerSkill(jianXiongSkill);
  registerSkill(gangLieSkill);
  registerSkill(fanKuiSkill);
  registerSkill(yaoWuSkill);
  registerSkill(tuXiSkill);
  registerSkill(luoYiSkill);
  registerSkill(lianYingSkill);
  registerSkill(xiaoJiSkill);
  registerSkill(fanJianSkill);
}
