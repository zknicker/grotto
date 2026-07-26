import * as React from 'react';
import { RouterProvider } from 'react-router-dom';
import { createAppRouter } from './app-router.tsx';

export default function App() {
    const router = React.useMemo(() => createAppRouter(), []);
    return <RouterProvider router={router} />;
}
