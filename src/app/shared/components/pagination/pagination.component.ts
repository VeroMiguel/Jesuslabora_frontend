import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="pagination-container" *ngIf="totalPages > 1">
      <button 
        class="pagination-btn" 
        [disabled]="currentPage === 1" 
        (click)="onPageChange(currentPage - 1)">
        <i class="fas fa-chevron-left"></i>
      </button>
      
      <div class="pagination-pages">
        <ng-container *ngFor="let page of pages">
          <button 
            *ngIf="page !== -1"
            class="page-btn" 
            [class.active]="page === currentPage"
            (click)="onPageChange(page)">
            {{ page }}
          </button>
          <span *ngIf="page === -1" class="pagination-dots">...</span>
        </ng-container>
      </div>
      
      <button 
        class="pagination-btn" 
        [disabled]="currentPage === totalPages" 
        (click)="onPageChange(currentPage + 1)">
        <i class="fas fa-chevron-right"></i>
      </button>
    </div>
    <div class="pagination-info" *ngIf="totalItems > 0">
      Mostrando {{ inicioMostrando }} - {{ finMostrando }} de {{ totalItems }} registros
    </div>
  `,
  styles: [`
    .pagination-container {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 10px;
      margin-top: 20px;
      flex-wrap: wrap;
    }
    
    .pagination-btn {
      width: 40px;
      height: 40px;
      border: 1px solid var(--bor, #e2e8f0);
      background: var(--surf, #ffffff);
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .pagination-btn:hover:not(:disabled) {
      background: var(--in, #f1f5f9);
      border-color: #6366f1;
    }
    
    .pagination-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .pagination-pages {
      display: flex;
      gap: 5px;
      flex-wrap: wrap;
      justify-content: center;
      align-items: center;
    }
    
    .page-btn {
      min-width: 40px;
      height: 40px;
      border: 1px solid var(--bor, #e2e8f0);
      background: var(--surf, #ffffff);
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .page-btn:hover:not(:disabled) {
      background: var(--in, #f1f5f9);
      border-color: #6366f1;
    }
    
    .page-btn.active {
      background: #6366f1;
      color: white;
      border-color: #6366f1;
    }
    
    .pagination-dots {
      padding: 0 5px;
      color: var(--mut, #64748b);
    }
    
    .pagination-info {
      text-align: center;
      margin-top: 10px;
      font-size: 0.85rem;
      color: var(--mut, #64748b);
    }
    
    @media (max-width: 768px) {
      .pagination-btn, .page-btn {
        min-width: 35px;
        height: 35px;
        font-size: 0.85rem;
      }
    }
  `]
})
export class PaginationComponent implements OnChanges {
  @Input() currentPage: number = 1;
  @Input() totalItems: number = 0;
  @Input() itemsPerPage: number = 10;
  @Output() pageChange = new EventEmitter<number>();

  get totalPages(): number {
    return Math.ceil(this.totalItems / this.itemsPerPage);
  }

  get inicioMostrando(): number {
    if (this.totalItems === 0) return 0;
    return (this.currentPage - 1) * this.itemsPerPage + 1;
  }

  get finMostrando(): number {
    return Math.min(this.currentPage * this.itemsPerPage, this.totalItems);
  }

  get pages(): number[] {
    const total = this.totalPages;
    const current = this.currentPage;
    const pages: number[] = [];
    
    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      if (current <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push(-1);
        pages.push(total);
      } else if (current >= total - 3) {
        pages.push(1);
        pages.push(-1);
        for (let i = total - 4; i <= total; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push(-1);
        for (let i = current - 1; i <= current + 1; i++) pages.push(i);
        pages.push(-1);
        pages.push(total);
      }
    }
    return pages;
  }

 // En pagination.component.ts - MODIFICA ngOnChanges
ngOnChanges(changes: SimpleChanges) {
  console.log('🔄 Pagination ngOnChanges:', {
    itemsPerPage: changes['itemsPerPage']?.currentValue,
    totalItems: changes['totalItems']?.currentValue,
    currentPage: this.currentPage,
    totalPages: this.totalPages
  });
  
  // Solo ajustar si la página actual excede el total de páginas
  if ((changes['itemsPerPage'] || changes['totalItems']) && this.currentPage > this.totalPages && this.totalPages > 0) {
    const nuevaPagina = this.totalPages;
    console.log(`🔄 Ajustando página de ${this.currentPage} a ${nuevaPagina}`);
    // Emitir el cambio al padre
    this.pageChange.emit(nuevaPagina);
  }
}

  onPageChange(page: number) {
    if (page !== this.currentPage && page >= 1 && page <= this.totalPages) {
      this.pageChange.emit(page);
    }
  }
}