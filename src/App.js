import React, { useState, useEffect } from "react";
import axios from "axios";
import TodoList from "./TodoList";
import TodoForm from "./TodoForm";
import CameraAccess from "./CameraAccess";

function App() {
  const [todos, setTodos] = useState([]);

  useEffect(() => {
    axios.get("https://todobackend-2-fhuw.onrender.com/api/todos")
      .then((res) => {
        // Handle the new response structure with pagination
        const todoData = res.data.todos || res.data;
        setTodos(todoData);
      })
      .catch((err) => {
        console.error("Error fetching todos:", err);
        setTodos([]);
      });
  }, []);

  const addTodo = (task) => {
    axios.post("https://todobackend-2-fhuw.onrender.com/api/todos", { task })
      .then((res) => {
        setTodos([...todos, res.data]);
      })
      .catch((err) => {
        console.error("Error adding todo:", err);
      });
  };

  const deleteTodo = (id) => {
    axios.delete(`https://todobackend-2-fhuw.onrender.com/api/todos/${id}`)
      .then(() => {
        setTodos(todos.filter((t) => t._id !== id));
      })
      .catch((err) => {
        console.error("Error deleting todo:", err);
      });
  };

  return (
    <div style={{ padding: "20px", textAlign: "center" }}>
      <h1>📝 Todo List (PWA)</h1>
      
      {/* Camera Section for Testing */}
      <div style={{ marginBottom: "30px" }}>
        <CameraAccess />
      </div>
      
      {/* Todo Section */}
      <div>
        <TodoForm addTodo={addTodo} />
        <TodoList todos={todos} deleteTodo={deleteTodo} />
      </div>
    </div>
  );
}

export default App;
