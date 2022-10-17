import { HubConnectionBuilder, HubConnectionState } from "@microsoft/signalr";
import {
  applyOperation,
  applyPatch,
  getValueByPointer,
  observe,
  Operation,
} from "fast-json-patch";
import "./style.css";
let state: any = {
  nodes: {},
};

const makeReverseOperation = (operation: Operation, state: any): Operation => {
  const { op, path } = operation;
  if (op === "add") {
    return {
      op: "remove",
      path: path,
    };
  }
  if (op === "remove") {
    return {
      op: "add",
      path: path,
      value: getValueByPointer(state, path),
    };
  }
  if (op === "replace") {
    return {
      op: "replace",
      path: path,
      value: getValueByPointer(state, path),
    };
  }
  return operation;
};

type UndoEntry = {
  do: Operation;
  undo: Operation;
};

const undoStack: UndoEntry[] = [];
const redoStack: UndoEntry[] = [];

const unconfirmedOperations: Record<number, Operation> = {};
(window as any).unconfirmedOperations = unconfirmedOperations;
window.onload = async () => {
  const connection = new HubConnectionBuilder()
    .withUrl("https://localhost:7266/connect")
    .withAutomaticReconnect()
    .build();

  const doOperationOnState = async (op: Operation) => {
    undoStack.push({
      do: op,
      undo: makeReverseOperation(op, state),
    });
    applyOperation(state, op);
    await broadcastOperation(op);
  };

  const broadcastOperation = async (op: Operation) => {
    console.log("sending ", [op], "to", connection.state);
    // await connection.send("Test", "hallo!");
    const rnId = Math.floor(Math.random() * 1_000_000);
    unconfirmedOperations[rnId] = op;
    if (connection.state === HubConnectionState.Connected) {
      await connection.send("BroadcastChanges", {
        confirmationCode: rnId,
        patchDocument: [op],
      });
    }
  };

  connection.on(
    "onChange",
    (patch: { confirmationCode: number; patchDocument: Operation[] }) => {
      console.log("receive onChange", patch);
      if (unconfirmedOperations[patch.confirmationCode]) {
        console.log("confirming", patch.confirmationCode);
        delete unconfirmedOperations[patch.confirmationCode];
      } else {
        applyPatch(state, patch.patchDocument);
        displayJson(patch);
      }
    }
  );
  observe(state, (ops) => {
    console.log("OBSERVE", ops);
  });

  connection.on("onInit", (serverState) => {
    state = serverState;
    Object.entries(unconfirmedOperations).forEach(async ([code, op]) => {
      console.log("replaying", code, op);
      await connection.send("BroadcastChanges", {
        confirmationCode: code,
        patchDocument: [op],
      });
    });
    displayJson([]);
  });

  connection.onreconnected(() => {
    Object.entries(unconfirmedOperations).forEach(async ([code, op]) => {
      console.log("replaying", code, op);
      await connection.send("BroadcastChanges", {
        confirmationCode: code,
        patchDocument: [op],
      });
    });
  });
  await connection.start();

  console.log("loaded");
  let lastGeneratedElement: string = "";

  const displayJson = (ops: any) => {
    document.getElementById("json")!.innerText = JSON.stringify(state, null, 2);
    document.getElementById("lastChange")!.innerText = JSON.stringify(
      ops,
      null,
      2
    );
  };

  document.getElementById("add")!.onclick = async (e) => {
    if (!state.nodes) {
      const op: Operation = {
        op: "add",
        path: "/nodes",
        value: {},
      };
      await doOperationOnState(op);
      displayJson(op);
    }
    let newId = "" + Math.trunc(Math.random() * 1000);
    lastGeneratedElement = newId;
    const add: Operation = {
      op: "add",
      path: `/nodes/${newId}`,
      value: {
        x: 1,
        name: "bla",
      },
    };
    await doOperationOnState(add);
    displayJson(add);
  };
  document.getElementById("remove")!.onclick = async (e) => {
    const remove: Operation = {
      op: "remove",
      path: `/nodes/${lastGeneratedElement}`,
    };
    await doOperationOnState(remove);
    displayJson(remove);
  };
  document.getElementById("change")!.onclick = async (e) => {
    const replace: Operation = {
      op: "replace",
      path: `/nodes/${lastGeneratedElement}/name`,
      value: "new name!",
    };

    await doOperationOnState(replace);
    displayJson(replace);
  };
  document.getElementById("undo")!.onclick = (e) => {
    const undoOp = undoStack.pop();
    if (undoOp) {
      applyOperation(state, undoOp.undo);
      broadcastOperation(undoOp.undo);
      redoStack.push(undoOp);
      displayJson(undoOp.undo);
    }
  };
  document.getElementById("redo")!.onclick = (e) => {
    const redoOp = redoStack.pop();
    if (redoOp) {
      applyOperation(state, redoOp.do);
      broadcastOperation(redoOp.do);
      undoStack.push(redoOp);
      displayJson(redoOp.do);
    }
  };
  document.getElementById("clear")!.onclick = async (e) => {
    const clear: Operation = {
      op: "replace",
      path: "/nodes",
      value: {},
    };
    await doOperationOnState(clear);
    displayJson(clear);
  };

  document.getElementById("startstopconnection")!.onclick = async (e) => {
    if (connection.state === HubConnectionState.Connected) {
      document.getElementById("startstopconnection")!.innerText =
        "Start Connection";
      await connection.stop();
      console.log("stopping");
      return;
    }
    if (connection.state === HubConnectionState.Disconnected) {
      console.log("starting");
      document.getElementById("startstopconnection")!.innerText =
        "Stop Connection";
      await connection.start();
      // Object.entries(unconfirmedOperations).forEach(async ([code, op]) => {
      //   console.log("replaying", code, op);
      //   await connection.send("BroadcastChanges", {
      //     confirmationCode: code,
      //     patchDocument: [op],
      //   });
      // });
    }
  };
};
