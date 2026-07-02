function App(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-white text-3xl font-bold">SK</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-800">Silver Knight</h1>
        <p className="text-gray-500 mt-2">Sistema POS — Perfil Small</p>
        <p className="text-sm text-gray-400 mt-1">API corriendo en puerto 3001</p>
      </div>
    </div>
  )
}

export default App
