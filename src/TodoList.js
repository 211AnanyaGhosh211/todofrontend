import React from "react";

function TodoList({ todos, deleteTodo }) {
  return (
    <ul style={{ listStyle: "none", padding: 0 }}>
      {todos.map((todo) => (
        <li key={todo._id} style={{ margin: "10px 0" }}>
          {todo.task}
          <button
            onClick={() => deleteTodo(todo._id)}
            style={{ marginLeft: "10px" }}
          >
            ❌
          </button>
        </li>
      ))}
    </ul>
  );
}

export default TodoList;
