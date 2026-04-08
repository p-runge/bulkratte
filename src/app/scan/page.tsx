import { ScanTester } from "./_components/scan-tester";

export default async function ScanPage() {
  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Card Scanner</h1>
      <ScanTester />
    </div>
  );
}
