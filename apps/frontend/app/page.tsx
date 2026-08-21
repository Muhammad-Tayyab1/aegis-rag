import Link from 'next/link'
export default function Home() {
	return (
		<main className="landing">
			<div className="eyebrow">AEGIS RAG / RETRIEVAL INTELLIGENCE</div>
			<h1>Know why every answer was given.</h1>
			<p>Secure, tenant-isolated RAG systems built for the data your clients already have.</p>
			<Link className="button" href="/login">
				Open workspace →
			</Link>
		</main>
	)
}
