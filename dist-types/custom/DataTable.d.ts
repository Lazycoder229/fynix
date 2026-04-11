type TableVariant = "primary" | "secondary" | "success" | "danger" | "warning" | "info" | "light" | "dark";
type ActionHandler<T = any> = (row: T, index: number) => void;
export interface ColumnDef<T = any> {
    key: keyof T | string;
    label: string;
    style?: Record<string, string>;
    class?: string;
    render?: (value: any, row: T, index: number) => any;
}
export interface ActionsDef<T = any> {
    view?: ActionHandler<T> | false;
    edit?: ActionHandler<T> | false;
    delete?: ActionHandler<T> | false;
    extra?: Array<{
        label: string;
        handler: ActionHandler<T>;
        style?: Record<string, string>;
        class?: string;
    }>;
}
export interface DataTableProps<T = any> {
    columns: ColumnDef<T>[];
    data: T[];
    actions?: ActionsDef<T>;
    variant?: TableVariant;
    outline?: boolean;
    striped?: boolean;
    hoverable?: boolean;
    bordered?: boolean;
    style?: Record<string, string>;
    class?: string;
    tableStyle?: Record<string, string>;
    tableClass?: string;
    rc?: string;
    [key: string]: any;
}
export declare function DataTable<T = any>({ columns, data, actions, style: wrapStyle, class: wrapClass, tableStyle, tableClass, rc, ...rest }: DataTableProps<T>): any;
export declare const PrimaryDataTable: <T>(p: DataTableProps<T>) => any;
export declare const SecondaryDataTable: <T>(p: DataTableProps<T>) => any;
export declare const SuccessDataTable: <T>(p: DataTableProps<T>) => any;
export declare const DangerDataTable: <T>(p: DataTableProps<T>) => any;
export declare const WarningDataTable: <T>(p: DataTableProps<T>) => any;
export declare const InfoDataTable: <T>(p: DataTableProps<T>) => any;
export declare const LightDataTable: <T>(p: DataTableProps<T>) => any;
export declare const DarkDataTable: <T>(p: DataTableProps<T>) => any;
export declare const OutlinePrimaryDataTable: <T>(p: DataTableProps<T>) => any;
export declare const OutlineSecondaryDataTable: <T>(p: DataTableProps<T>) => any;
export declare const OutlineSuccessDataTable: <T>(p: DataTableProps<T>) => any;
export declare const OutlineDangerDataTable: <T>(p: DataTableProps<T>) => any;
export declare const OutlineWarningDataTable: <T>(p: DataTableProps<T>) => any;
export declare const OutlineInfoDataTable: <T>(p: DataTableProps<T>) => any;
export declare const OutlineLightDataTable: <T>(p: DataTableProps<T>) => any;
export declare const OutlineDarkDataTable: <T>(p: DataTableProps<T>) => any;
export {};
