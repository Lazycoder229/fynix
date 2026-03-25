interface LocationSignal {
    path: string;
    params: Record<string, string>;
    search: string;
}
declare class LocationManager {
    private current;
    private subscribers;
    get value(): LocationSignal;
    set value(newLocation: LocationSignal);
    subscribe(callback: (location: LocationSignal) => void): () => void;
}
export declare const location: LocationManager;
interface RouteComponent {
    (props: any): any;
    props?: Record<string, any> | (() => Record<string, any>);
    meta?: RouteMeta | ((params: Record<string, string>) => RouteMeta);
}
interface RouteMeta {
    title?: string;
    description?: string;
    keywords?: string;
    twitterCard?: string;
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
}
interface DynamicRoute {
    pattern: string;
    regex: RegExp;
    component: RouteComponent;
    params: string[];
}
interface FynixRouterOptions {
    lazy?: boolean;
}
interface FynixRouter {
    mountRouter(selector?: string): void;
    navigate(path: string, props?: Record<string, any>): void;
    replace(path: string, props?: Record<string, any>): void;
    back(): void;
    cleanup(): void;
    routes: Record<string, RouteComponent>;
    dynamicRoutes: DynamicRoute[];
    clearCache?(): void;
}
declare function createFynix(options?: FynixRouterOptions): FynixRouter;
export { createFynix };
export default createFynix;
export declare function setLinkProps(key: string, props: Record<string, any>): void;
export declare function clearLinkProps(key: string): void;
