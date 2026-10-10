"use client";
import { Children, cloneElement, createContext, isValidElement, useContext, useState, type ReactNode, type ReactElement, type ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type Element = ReactElement<{ children?: ReactNode; checked?: boolean; label?: string }>;
export const RecordTableContext = createContext(false);
export function RecordTable(props: ComponentProps<"table">) { const enabled = useContext(RecordTableContext); const table = <table {...props}/>; return enabled ? <EntityRecordTable table={table}/> : table; }
function name(node: Element) { return typeof node.type === "string" ? node.type : (node.type as {displayName?:string;name?:string}).displayName || (node.type as {name?:string}).name; }
function textOf(node: ReactNode): string { if (typeof node === "string" || typeof node === "number") return String(node); if (Array.isArray(node)) return node.map(textOf).join(" "); if (isValidElement(node)) return textOf((node as Element).props.children); return ""; }
function statusOf(node: ReactNode): boolean | undefined {
 for(const child of Children.toArray(node)) if(isValidElement(child)){const element=child as Element;if(typeof element.props.checked === "boolean")return element.props.checked;const result=statusOf(element.props.children);if(result!==undefined)return result;}return undefined;
}
/** Decorates existing row elements, preserving their real handlers and API data. */
export function EntityRecordTable({table}:{table:Element}) {
 const [search,setSearch]=useState("");const [status,setStatus]=useState("");const [page,setPage]=useState(1);const [size,setSize]=useState(25);
 let body:Element|undefined;
 function find(node:ReactNode){for(const child of Children.toArray(node))if(isValidElement(child)){const element=child as Element;if(["tbody","TableBody"].includes(name(element)||""))body=element;else find(element.props.children);}}
 find(table.props.children);
 if(!body)return table;
 const all=Children.toArray(body.props.children).filter(isValidElement) as Element[];
 const records=all.filter(row=>row.key!==null&&!textOf(row).match(/^\s*(No |Loading)/i));
 const filtered=records.filter(row=>(!search||textOf(row).toLowerCase().includes(search.toLowerCase()))&&(!status||statusOf(row)===(status==="active")));
 const pages=Math.max(1,Math.ceil(filtered.length/size));const current=Math.min(page,pages);const shown=filtered.slice((current-1)*size,current*size);const hasStatus=records.some(row=>statusOf(row)!==undefined);
 function replace(node:ReactNode):ReactNode{return Children.map(node,child=>{if(!isValidElement(child))return child;const element=child as Element;if(element===body)return cloneElement(element,{},shown.length?shown:records.length?<tr><td colSpan={30} className="p-8 text-center text-slate-500">No records match your filters.</td></tr>:element.props.children);return element.props.children?cloneElement(element,{},replace(element.props.children)):element;});}
 return <div className="min-w-0 space-y-3"><div className="flex flex-wrap gap-2"><Input aria-label="Search records" placeholder="Search records…" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} className="max-w-sm"/>{hasStatus&&<Select aria-label="Filter record status" value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}} className="w-40"><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></Select>}</div><div className="max-w-full overflow-x-auto">{cloneElement(table,{},replace(table.props.children))}</div><div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500"><span>{filtered.length} records · Page {current} of {pages}</span><div className="flex items-center gap-2"><Select aria-label="Records per page" value={size} onChange={e=>{setSize(Number(e.target.value));setPage(1);}}>{[10,25,50,100].map(n=><option key={n} value={n}>{n} / page</option>)}</Select><Button type="button" variant="outline" disabled={current===1} onClick={()=>setPage(current-1)}>Previous</Button><Button type="button" variant="outline" disabled={current===pages} onClick={()=>setPage(current+1)}>Next</Button></div></div></div>;
}
export function withRecordTables(node:ReactNode):ReactNode{return Children.map(node,child=>{if(!isValidElement(child))return child;const element=child as Element;if(["table","Table"].includes(name(element)||""))return <EntityRecordTable table={element}/>;return element.props.children?cloneElement(element,{},withRecordTables(element.props.children)):element;});}
