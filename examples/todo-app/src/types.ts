/**
 * Todo item type definition
 */
export interface Todo {
  id: string
  text: string
  completed: boolean
  createdAt: number
}

/**
 * TodoList document structure
 */
export interface TodoListDocument {
  todos: Record<string, Todo>
  lastUpdated: number
}
