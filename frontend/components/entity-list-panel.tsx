"use client";
/* eslint-disable react-hooks/set-state-in-effect -- synchronize route intent and protected form state. */
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { RecordTableContext } from "@/components/entity-record-table";
type Workspace = { title: string; open: () => void; close: () => void; intent: (save: boolean | null) => void; form: boolean; formKey: string; listHref: string; dirty: boolean; cancel: (callback?: () => void) => void; saved: () => void; createHref: (key?: string) => string };
const ListContext = createContext<Workspace | null>(null);
export const useEntityList = () => useContext(ListContext);
export const EmbeddedListContext = createContext(false);
export function entityListPath(path: string) { return path.replace(/\/(?:create|add|[^/]+\/edit)$/, ""); }
export function showEntityList(path?: string) { window.dispatchEvent(new CustomEvent("anhh-open-list", { detail: path })); }
export function openEntityEdit(id: string, formKey = "0") { window.dispatchEvent(new CustomEvent("anhh-edit-record", { detail: { id, formKey } })); }
export function entitySaveComplete() { window.dispatchEvent(new Event("anhh-entity-save-complete")); }
export function routeEntityEdit(id: string, formKey = "0") { if (/\/edit$/.test(window.location.pathname)) return false; openEntityEdit(id,formKey); return true; }
/** Parents own data and persistence; URLs own list/form navigation. */
export function EntityListWorkspace({ children, title = "Records", enabled = true }: { children: ReactNode; title?: string; enabled?: boolean }) {
 const pathname = usePathname(); const query = useSearchParams(); const router = useRouter();
 const form = /\/(create|add|edit)$/.test(pathname);
 const [dirty,setDirty] = useState(false); const intent = useRef<boolean | null>(null);
 const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
 const base = entityListPath(pathname);
 const cleanQuery = useCallback(() => { const next = new URLSearchParams(query.toString()); next.delete("form"); next.delete("record"); return next; }, [query]);
 const listHref = base + (cleanQuery().size ? `?${cleanQuery()}` : "");
 const createHref = useCallback((key = "0") => { const next = cleanQuery(); if(key !== "0") next.set("form",key); return `${base}/create${next.size ? `?${next}` : ""}`; },[base,cleanQuery]);
 const open = useCallback(() => {setDirty(false);router.push(listHref);},[router,listHref]);
 const setIntent = useCallback((value:boolean|null) => {intent.current=value;},[]);
 const cancel = useCallback((callback?:()=>void) => { if(dirty && !window.confirm("Discard unsaved changes and return to the list?"))return;setDirty(false);callback?.();router.push(listHref);},[dirty,listHref,router]);
 const saved = useCallback(() => {setDirty(false);if(intent.current === true){intent.current=null;pending.current=setTimeout(open,0);}},[open]);
 useEffect(() => {
  if(!enabled)return;
  const show=(event:Event)=>{if(intent.current===null)return;const path=(event as CustomEvent<string|undefined>).detail;if(path && entityListPath(path)!==base && !base.startsWith(entityListPath(path)+"/"))return;if(intent.current===false){intent.current=null;setDirty(false);return;}open();};
  const edit=(event:Event)=>{const {id,formKey}=(event as CustomEvent<{id:string;formKey:string}>).detail;const next=cleanQuery();if(formKey!=="0")next.set("form",formKey);router.push(`${base}/${encodeURIComponent(id)}/edit${next.size?`?${next}`:""}`);};
  window.addEventListener("anhh-open-list",show);window.addEventListener("anhh-edit-record",edit);window.addEventListener("anhh-entity-save-complete",saved);
  return()=>{window.removeEventListener("anhh-open-list",show);window.removeEventListener("anhh-edit-record",edit);window.removeEventListener("anhh-entity-save-complete",saved);if(pending.current)clearTimeout(pending.current);};
 },[enabled,base,cleanQuery,open,router,saved]);
 useEffect(()=>{const warn=(event:BeforeUnloadEvent)=>{if(dirty){event.preventDefault();event.returnValue="";}};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);},[dirty]);
 const value=useMemo(()=>({title,open,close:()=>{},intent:setIntent,form,formKey:query.get("form")||"0",listHref,dirty,cancel,saved,createHref}),[title,open,setIntent,form,query,listHref,dirty,cancel,saved,createHref]);
 if(!enabled)return children;
 return <ListContext.Provider value={value}><div className="min-w-0" data-entity-workspace={title} onSubmitCapture={event => { if((event.target as HTMLElement).closest("[data-entity-workspace]") !== event.currentTarget)return; if(form && intent.current===null)intent.current=true; }} onChangeCapture={event=>{if((event.target as HTMLElement).closest("[data-entity-workspace]") === event.currentTarget && form && (event.target as HTMLElement).closest("form"))setDirty(true);}}>{children}</div></ListContext.Provider>;
}
export function EntityFormPanel({children,formKey="0"}:{children:ReactNode;formKey?:string}) {
 const pathname=usePathname(); const list=useEntityList();if(list && (!list.form || list.formKey!==formKey))return null;
 return <div className="min-w-0 w-full" data-entity-form={formKey}>{list && <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2 text-sm text-slate-500"><button type="button" onClick={()=>list.cancel()} className="hover:underline">{list.title}</button><span>/</span><span>{/\/edit$/.test(pathname) ? "Edit" : "Add"}</span></nav>}{children}</div>;
}
export function EntityListPanel({children,formKey="0",addLabel="Add record",canAdd=true}:{children:ReactNode;formKey?:string;addLabel?:string;canAdd?:boolean}) {
 const list=useEntityList();if(list?.form)return null;
 return <div className="min-w-0 w-full space-y-3" data-entity-list={formKey}>{list && <div className="flex flex-wrap items-center justify-between gap-3"><nav aria-label="Breadcrumb" className="text-sm text-slate-500">{list.title}</nav>{canAdd && <Link className={buttonVariants()} href={list.createHref(formKey)}><Plus size={16}/>{addLabel}</Link>}</div>}<EmbeddedListContext.Provider value={false}><RecordTableContext.Provider value={true}>{children}</RecordTableContext.Provider></EmbeddedListContext.Provider></div>;
}
export function ListButton(){const list=useEntityList();return list?<Button type="button" variant="outline" onClick={()=>list.cancel()}><ArrowLeft size={16}/>Back to list</Button>:null;}
/** Reload edits from current API rows, including refresh/direct URL access. */
export function useEntityRecord<T extends {id:string}>(rows:T[],edit:(row:T)=>void,formKey="0") {
 const pathname=usePathname();const query=useSearchParams();const callback=useRef(edit);const loaded=useRef("");
 useEffect(()=>{callback.current=edit;},[edit]);
 useEffect(()=>{const id=pathname.match(/\/([^/]+)\/edit$/)?.[1];if(!id || (query.get("form")||"0")!==formKey || loaded.current===id)return;const row=rows.find(x=>x.id===id);if(row){loaded.current=id;callback.current(row);}},[pathname,query,rows,formKey]);
}
export function useWorkspaceSelection<T extends string>(key:string,initial:T):[T,(next:T)=>void] {
 const pathname=usePathname();const query=useSearchParams();const router=useRouter();
 return [(query.get(key)||initial) as T,next=>{if(next === (query.get(key)||initial))return;const params=new URLSearchParams(query.toString());params.set(key,next);params.delete("form");router.push(`${entityListPath(pathname)}?${params}`);}];
}
