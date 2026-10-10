import { connect } from "./mcp.mjs";
const c = await connect("probe");
const task = "t-" + Date.now();
const show = (l, m) => console.log("\n##", l, "\n", JSON.stringify(m).slice(0, 900));
show("task_open", await c.call("agntid_task_open", { task_id: task, agent_id: "analyst", user_id: "you", prompt: "Check the status of ticket LAB-TKT-100" }));
show("ticket 100", await c.call("demo_get_ticket", { ticket_id: "LAB-TKT-100", agntid_task_id: task }));
show("ticket 200", await c.call("demo_get_ticket", { ticket_id: "LAB-TKT-200", agntid_task_id: task }));
show("no task", await c.call("demo_get_ticket", { ticket_id: "LAB-TKT-100" }));
show("close", await c.call("agntid_task_close", { task_id: task }));
