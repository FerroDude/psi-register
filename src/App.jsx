import { useState, useEffect, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts'
import { collection, addDoc, deleteDoc, doc, query, orderBy, onSnapshot } from 'firebase/firestore'
import { db, isFirebaseConfigured } from './firebase'
import './App.css'
import 'react-tabs/style/react-tabs.css'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('app_authenticated') === 'true'
  })
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [entries, setEntries] = useState([])
  const [filterPeriod, setFilterPeriod] = useState('all')
  const [formData, setFormData] = useState({
    dataHora: '',
    situacao: '',
    pensamento: '',
    emocao: '',
    sintomasFisicos: '',
    estrategia: '',
    eficacia: 50,
    intensidade: 50
  })

  const handlePasswordSubmit = (e) => {
    e.preventDefault()
    if (password.toLowerCase() === 'racional') {
      setIsAuthenticated(true)
      localStorage.setItem('app_authenticated', 'true')
      setPasswordError('')
      setPassword('')
    } else {
      setPasswordError('Palavra incorreta')
      setPassword('')
    }
  }

  useEffect(() => {
    let unsubscribe
    
    if (isFirebaseConfigured && db) {
      // Use Firebase real-time sync
      try {
        // First try with orderBy, if it fails (no index), fall back to without orderBy
        const q = query(collection(db, 'entries'), orderBy('dataHora', 'desc'))
        unsubscribe = onSnapshot(
          q,
          (querySnapshot) => {
            const entriesData = []
            querySnapshot.forEach((doc) => {
              entriesData.push({ id: doc.id, ...doc.data() })
            })
            // Sort manually in case orderBy didn't work
            entriesData.sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora))
            setEntries(entriesData)
            // Also save to localStorage as backup
            localStorage.setItem('entries', JSON.stringify(entriesData))
          },
          (error) => {
            console.error('Error in real-time sync with orderBy:', error)
            // Try without orderBy
            const qSimple = collection(db, 'entries')
            unsubscribe = onSnapshot(
              qSimple,
              (querySnapshot) => {
                const entriesData = []
                querySnapshot.forEach((doc) => {
                  entriesData.push({ id: doc.id, ...doc.data() })
                })
                // Sort manually
                entriesData.sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora))
                setEntries(entriesData)
                localStorage.setItem('entries', JSON.stringify(entriesData))
              },
              (error2) => {
                console.error('Error in real-time sync:', error2)
                // Fallback to localStorage
                const stored = localStorage.getItem('entries')
                if (stored) {
                  setEntries(JSON.parse(stored))
                }
              }
            )
          }
        )
      } catch (error) {
        console.error('Error setting up Firebase:', error)
        // Fallback to localStorage
        const stored = localStorage.getItem('entries')
        if (stored) {
          setEntries(JSON.parse(stored))
        }
      }
    } else {
      console.log('Firebase not configured, using localStorage')
      // Firebase not configured, use localStorage
      const stored = localStorage.getItem('entries')
      if (stored) {
        setEntries(JSON.parse(stored))
      }
    }
    
    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const newEntry = {
      ...formData,
      dataHora: formData.dataHora || new Date().toISOString().slice(0, 16)
    }
    
    if (isFirebaseConfigured && db) {
      try {
        // Save to Firebase
        console.log('Saving to Firebase:', newEntry)
        const docRef = await addDoc(collection(db, 'entries'), newEntry)
        console.log('Entry saved with ID:', docRef.id)
        // Note: Real-time listener will update entries automatically
      } catch (error) {
        console.error('Error adding entry to Firebase:', error)
        console.error('Error details:', error.code, error.message)
        // Fallback: save locally
        const localEntry = {
          id: Date.now(),
          ...newEntry
        }
        const updatedEntries = [localEntry, ...entries]
        setEntries(updatedEntries)
        localStorage.setItem('entries', JSON.stringify(updatedEntries))
      }
    } else {
      console.log('Firebase not configured, saving to localStorage')
      // Firebase not configured, use localStorage
      const localEntry = {
        id: Date.now(),
        ...newEntry
      }
      const updatedEntries = [localEntry, ...entries]
      setEntries(updatedEntries)
      localStorage.setItem('entries', JSON.stringify(updatedEntries))
    }
    
    setFormData({
      dataHora: '',
      situacao: '',
      pensamento: '',
      emocao: '',
      sintomasFisicos: '',
      estrategia: '',
      eficacia: 50,
      intensidade: 50
    })
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: (name === 'eficacia' || name === 'intensidade') ? parseInt(value) || 0 : value
    }))
  }

  const deleteEntry = async (id) => {
    if (isFirebaseConfigured && db) {
      try {
        // Delete from Firebase
        await deleteDoc(doc(db, 'entries', id))
        // Note: Real-time listener will update entries automatically
      } catch (error) {
        console.error('Error deleting entry from Firebase:', error)
        // Fallback: delete locally
        const updatedEntries = entries.filter(entry => entry.id !== id)
        setEntries(updatedEntries)
        localStorage.setItem('entries', JSON.stringify(updatedEntries))
      }
    } else {
      // Firebase not configured, use localStorage
      const updatedEntries = entries.filter(entry => entry.id !== id)
      setEntries(updatedEntries)
      localStorage.setItem('entries', JSON.stringify(updatedEntries))
    }
  }

  const filterEntriesByPeriod = (entriesToFilter) => {
    const now = new Date()
    const entryDate = (entry) => new Date(entry.dataHora)

    switch (filterPeriod) {
      case 'day':
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        return entriesToFilter.filter(entry => {
          const date = entryDate(entry)
          return date >= today
        })
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        return entriesToFilter.filter(entry => entryDate(entry) >= weekAgo)
      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        return entriesToFilter.filter(entry => entryDate(entry) >= monthAgo)
      default:
        return entriesToFilter
    }
  }

  const filteredEntries = useMemo(() => {
    return filterEntriesByPeriod(entries)
  }, [entries, filterPeriod])

  const exportToExcel = () => {
    const worksheetData = filteredEntries.map(entry => ({
      'Data/Hora': new Date(entry.dataHora).toLocaleString('pt-PT'),
      'Situação': entry.situacao || '',
      'Pensamento': entry.pensamento || '',
      'Emoção': entry.emocao || '',
      'Sintomas Físicos': entry.sintomasFisicos || '',
      'Estratégia': entry.estrategia || '',
      'Eficácia': entry.eficacia,
      'Intensidade': entry.intensidade || 0
    }))

    const ws = XLSX.utils.json_to_sheet(worksheetData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Registos')
    
    const wscols = [
      { wch: 20 },
      { wch: 30 },
      { wch: 30 },
      { wch: 30 },
      { wch: 30 },
      { wch: 30 },
      { wch: 10 },
      { wch: 10 }
    ]
    ws['!cols'] = wscols

    XLSX.writeFile(wb, `registos_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const sortedEntries = useMemo(() => {
    return [...filteredEntries].sort((a, b) => {
      return new Date(b.dataHora) - new Date(a.dataHora)
    })
  }, [filteredEntries])

  const chartDataEntriesPerDay = useMemo(() => {
    const dailyMap = {}
    
    filteredEntries.forEach(entry => {
      const date = new Date(entry.dataHora).toLocaleDateString('pt-PT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
      
      if (!dailyMap[date]) {
        dailyMap[date] = 0
      }
      dailyMap[date]++
    })

    return Object.keys(dailyMap)
      .sort((a, b) => {
        return new Date(a.split('/').reverse().join('-')) - new Date(b.split('/').reverse().join('-'))
      })
      .map(date => ({
        date,
        quantidade: dailyMap[date]
      }))
  }, [filteredEntries])


  if (!isAuthenticated) {
    return (
      <div className="login-screen">
        <div className="login-container">
          <form onSubmit={handlePasswordSubmit} className="login-form">
            <div className="login-form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setPasswordError('')
                }}
                placeholder="Digite a palavra"
                autoFocus
              />
              {passwordError && <p className="password-error">{passwordError}</p>}
            </div>
            <button type="submit" className="login-btn">
              Entrar
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header>
        <h1>Registo</h1>
        <div className="header-controls">
          <select
            className="filter-select"
            value={filterPeriod}
            onChange={(e) => setFilterPeriod(e.target.value)}
          >
            <option value="all">Todos</option>
            <option value="day">Hoje</option>
            <option value="week">Última Semana</option>
            <option value="month">Último Mês</option>
          </select>
          {filteredEntries.length > 0 && (
            <button className="export-btn" onClick={exportToExcel}>
              Exportar para Excel
            </button>
          )}
        </div>
      </header>

      <Tabs>
        <TabList>
          <Tab>Entradas</Tab>
          <Tab>Gráficos</Tab>
        </TabList>

        <TabPanel>
          <div className="main-container">
            <section className="form-section">
              <h2>Nova Entrada</h2>
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="dataHora">Data/Hora</label>
                  <input
                    type="datetime-local"
                    id="dataHora"
                    name="dataHora"
                    value={formData.dataHora}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="situacao">Situação</label>
                  <textarea
                    id="situacao"
                    name="situacao"
                    value={formData.situacao}
                    onChange={handleChange}
                    rows="2"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="pensamento">Pensamento</label>
                  <textarea
                    id="pensamento"
                    name="pensamento"
                    value={formData.pensamento}
                    onChange={handleChange}
                    rows="2"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="emocao">Emoção</label>
                  <textarea
                    id="emocao"
                    name="emocao"
                    value={formData.emocao}
                    onChange={handleChange}
                    rows="2"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="sintomasFisicos">Sintomas Físicos</label>
                  <textarea
                    id="sintomasFisicos"
                    name="sintomasFisicos"
                    value={formData.sintomasFisicos}
                    onChange={handleChange}
                    rows="2"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="estrategia">Estratégia</label>
                  <textarea
                    id="estrategia"
                    name="estrategia"
                    value={formData.estrategia}
                    onChange={handleChange}
                    rows="2"
                  />
                </div>

                <div className="form-group form-group-range">
                  <label htmlFor="eficacia">
                    Eficácia: {formData.eficacia}%
                  </label>
                  <input
                    type="range"
                    id="eficacia"
                    name="eficacia"
                    min="0"
                    max="100"
                    value={formData.eficacia}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group form-group-range">
                  <label htmlFor="intensidade">
                    Intensidade: {formData.intensidade}%
                  </label>
                  <input
                    type="range"
                    id="intensidade"
                    name="intensidade"
                    min="0"
                    max="100"
                    value={formData.intensidade}
                    onChange={handleChange}
                  />
                </div>

                <button type="submit" className="submit-btn">
                  Adicionar
                </button>
              </form>
            </section>

            <section className="table-section">
              <h2>Dados ({filteredEntries.length} {filteredEntries.length === 1 ? 'entrada' : 'entradas'})</h2>
              {filteredEntries.length === 0 ? (
                <p className="empty-message">Ainda não há entradas registadas para este período.</p>
              ) : (
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Data/Hora</th>
                        <th>Situação</th>
                        <th>Pensamento</th>
                        <th>Emoção</th>
                        <th>Sintomas Físicos</th>
                        <th>Estratégia</th>
                        <th>Eficácia</th>
                        <th>Intensidade</th>
                        <th>Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedEntries.map(entry => {
                        const dateTime = new Date(entry.dataHora).toLocaleString('pt-PT')
                        return (
                          <tr key={entry.id}>
                            <td>{dateTime}</td>
                            <td>{entry.situacao || '-'}</td>
                            <td>{entry.pensamento || '-'}</td>
                            <td>{entry.emocao || '-'}</td>
                            <td>{entry.sintomasFisicos || '-'}</td>
                            <td>{entry.estrategia || '-'}</td>
                            <td>{entry.eficacia}%</td>
                            <td>{(entry.intensidade || 0)}%</td>
                            <td>
                              <button
                                className="delete-btn-small"
                                onClick={() => deleteEntry(entry.id)}
                                aria-label="Eliminar"
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </TabPanel>

        <TabPanel>
          {filteredEntries.length === 0 ? (
            <p className="empty-message">Ainda não há entradas registadas para este período.</p>
          ) : (
            <section className="charts-section">
              <div className="chart-wrapper">
                <h2>Quantidade de Entradas por Dia</h2>
                <ResponsiveContainer width="100%" height={500}>
                  <BarChart 
                    data={chartDataEntriesPerDay}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                  >
                    <defs>
                      <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#646cff" stopOpacity={0.9}/>
                        <stop offset="95%" stopColor="#646cff" stopOpacity={0.6}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                    <XAxis 
                      dataKey="date" 
                      height={60}
                      stroke="rgba(255, 255, 255, 0.7)"
                      tick={{ fill: 'rgba(255, 255, 255, 0.8)', fontSize: 12 }}
                      tickLine={{ stroke: 'rgba(255, 255, 255, 0.3)' }}
                      interval="preserveStartEnd"
                    />
                    <YAxis 
                      stroke="rgba(255, 255, 255, 0.7)"
                      tick={{ fill: 'rgba(255, 255, 255, 0.8)', fontSize: 12 }}
                      tickLine={{ stroke: 'rgba(255, 255, 255, 0.3)' }}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        border: '1px solid rgba(100, 108, 255, 0.5)',
                        borderRadius: '8px',
                        color: '#fff',
                        padding: '10px'
                      }}
                      labelStyle={{ color: '#646cff', fontWeight: 'bold' }}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: '20px' }}
                      iconType="rect"
                    />
                    <Bar 
                      dataKey="quantidade" 
                      name="Número de Entradas"
                      radius={[8, 8, 0, 0]}
                    >
                      {chartDataEntriesPerDay.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill="url(#colorGradient)" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}
        </TabPanel>
      </Tabs>
    </div>
  )
}

export default App
