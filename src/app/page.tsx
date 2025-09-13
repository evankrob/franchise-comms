export default function Home() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
      <h1>Franchise Communications API</h1>
      <p>Application is running successfully!</p>
      <p>Build time: {new Date().toISOString()}</p>
      
      <h2>Available Routes:</h2>
      <ul>
        <li><a href="/test">/test</a> - Test page</li>
        <li><a href="/auth/login">/auth/login</a> - Login page</li>
        <li><a href="/api/tenants/current">/api/tenants/current</a> - Current tenant API</li>
      </ul>
    </div>
  );
}
