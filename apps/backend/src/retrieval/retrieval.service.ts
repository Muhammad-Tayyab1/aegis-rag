import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/database/prisma.service';
export type Hit={id:string;documentId:string;filename:string;content:string;score:number;rank?:number};
export const embed=(text:string)=>{const v=Array(384).fill(0);for(let i=0;i<text.length;i++)v[(text.charCodeAt(i)*31+i)%384]+=text.charCodeAt(i)%17/17;const n=Math.hypot(...v)||1;return v.map(x=>x/n)};
@Injectable() export class RetrievalService {
 constructor(private prisma:PrismaService){}
 async search(tenantId:string, question:string, limit=8):Promise<Hit[]> {const e=`[${embed(question).join(',')}]`;return this.prisma.withTenant(tenantId,async tx=>{const [vector,keyword]=await Promise.all([
 tx.$queryRaw<Hit[]>(Prisma.sql`SELECT c.id, c.document_id AS "documentId", d.filename, c.content, (1-(c.embedding <=> ${e}::vector))::float AS score FROM chunks c JOIN documents d ON d.id=c.document_id WHERE c.embedding IS NOT NULL ORDER BY c.embedding <=> ${e}::vector LIMIT ${limit}`),
 tx.$queryRaw<Hit[]>(Prisma.sql`SELECT c.id, c.document_id AS "documentId", d.filename, c.content, ts_rank_cd(c.tsv, websearch_to_tsquery('english', ${question}))::float AS score FROM chunks c JOIN documents d ON d.id=c.document_id WHERE c.tsv @@ websearch_to_tsquery('english', ${question}) ORDER BY score DESC LIMIT ${limit}`)
 ]); const scores=new Map<string,{h:Hit;s:number}>();[vector,keyword].forEach(list=>list.forEach((h,i)=>{const x=scores.get(h.id)??{h,s:0};x.s+=1/(60+i+1);scores.set(h.id,x)}));return [...scores.values()].sort((a,b)=>b.s-a.s).slice(0,limit).map((x,i)=>({...x.h,score:x.s,rank:i+1}));});}
}
