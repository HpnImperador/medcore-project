'use client';
import { useState, useEffect } from 'react';

export default function Dashboard() {
  const [patients, setPatients] = useState([]);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', organization_id: 'e02d350d-df6e-474f-abea-2d8d9f6abc45' });
  const [status, setStatus] = useState('');

  const fetchPatients = async () => {
    try {
      const res = await fetch('http://192.168.0.109:3000/patients');
      const data = await res.json();
      setPatients(data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchPatients(); }, []);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setStatus('Salvando...');
    const res = await fetch('http://192.168.0.109:3000/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    if (res.ok) {
      setStatus('✅ Sucesso!');
      setFormData({ ...formData, name: '', email: '', phone: '' });
      fetchPatients();
    }
  };

  return (
    <main className="p-8 text-slate-800">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-8">
        <div className="md:w-1/3 bg-white p-6 rounded-xl shadow-md border border-slate-200">
          <h2 className="text-xl font-bold mb-4">Novo Cadastro</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input placeholder="Nome" className="w-full p-2 border rounded bg-white" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
            <input placeholder="E-mail" className="w-full p-2 border rounded bg-white" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
            <input placeholder="Telefone" className="w-full p-2 border rounded bg-white" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            <button className="w-full bg-blue-600 text-white p-2 rounded font-bold hover:bg-blue-700">Salvar</button>
          </form>
          {status && <p className="mt-2 text-center text-sm font-bold">{status}</p>}
        </div>
        <div className="md:w-2/3 bg-white p-6 rounded-xl shadow-md border border-slate-200">
          <h2 className="text-xl font-bold mb-4">Pacientes no Banco</h2>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b text-slate-400">
                <th className="py-2">Nome</th>
                <th className="py-2">E-mail</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p: any) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="py-2 font-medium">{p.name}</td>
                  <td className="py-2 text-sm text-slate-500">{p.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
